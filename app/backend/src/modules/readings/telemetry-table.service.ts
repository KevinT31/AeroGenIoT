import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type ExternalTelemetryFilters = {
  deviceId?: string;
  farmId?: string;
  plotId?: string;
  take?: number;
};

type ExternalTelemetryView = Record<string, unknown>;

const DEFAULT_COLUMN_MAP = {
  id: "id",
  device_id: "device_id",
  farm_id: "farm_id",
  plot_id: "plot_id",
  timestamp: "timestamp",
  wind_speed_mps: "wind_speed_mps",
  wind_dir_deg: "wind_dir_deg",
  battery_voltage_dc_v: "battery_voltage_dc_v",
  battery_current_dc_a: "battery_current_dc_a",
  battery_power_w: "battery_power_w",
  battery_soc_pct: "battery_soc_pct",
  battery_autonomy_estimated_h: "battery_autonomy_estimated_h",
  battery_alert_low: "battery_alert_low",
  battery_alert_overload: "battery_alert_overload",
  battery_alert_overtemp: "battery_alert_overtemp",
  inverter_output_voltage_ac_v: "inverter_output_voltage_ac_v",
  inverter_output_current_ac_a: "inverter_output_current_ac_a",
  house_power_consumption_w: "house_power_consumption_w",
  energy_delivered_wh: "energy_delivered_wh",
  inverter_alert_overload: "inverter_alert_overload",
  inverter_alert_fault: "inverter_alert_fault",
  inverter_alert_supply_cut: "inverter_alert_supply_cut",
  inverter_temp_c: "inverter_temp_c",
  motor_vibration: "motor_vibration",
  vibration_signal: "vibration_signal",
  blade_rpm: "blade_rpm",
} as const;

type LogicalColumn = keyof typeof DEFAULT_COLUMN_MAP;

@Injectable()
export class TelemetryTableService {
  private readonly logger = new Logger(TelemetryTableService.name);
  private columnsCache: Promise<Set<string>> | null = null;

  constructor(private prisma: PrismaService) {}

  isEnabled() {
    return String(process.env.READINGS_SOURCE || "prisma")
      .trim()
      .toLowerCase() === "telemetry_table";
  }

  async latest(deviceId: string) {
    const rows = await this.fetchRows({ deviceId, take: 1 });
    return rows[0] ?? null;
  }

  async list(filters: ExternalTelemetryFilters) {
    return this.fetchRows(filters);
  }

  private async fetchRows(filters: ExternalTelemetryFilters): Promise<ExternalTelemetryView[]> {
    const availableColumns = await this.getAvailableColumns();
    const tableName = this.getTableName();
    const columnMap = this.resolveColumnMap(availableColumns);
    const defaultDeviceId = String(process.env.TELEMETRY_DEFAULT_DEVICE_ID || "").trim() || undefined;
    const limit = Math.max(1, Math.min(Number(filters.take || 200), 500));

    const selectAliases = Object.keys(DEFAULT_COLUMN_MAP) as LogicalColumn[];
    const selectClause = selectAliases
      .map((alias) => {
        const column = columnMap[alias];
        if (!column) return `NULL AS \`${alias}\``;
        return `\`${column}\` AS \`${alias}\``;
      })
      .join(", ");

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    const deviceId = String(filters.deviceId || defaultDeviceId || "").trim() || null;
    if (deviceId) {
      if (!columnMap.device_id) {
        throw new BadRequestException("La tabla telemetry no tiene una columna configurada para device_id.");
      }
      whereClauses.push(`\`${columnMap.device_id}\` = ?`);
      params.push(deviceId);
    }

    if (filters.farmId && columnMap.farm_id) {
      whereClauses.push(`\`${columnMap.farm_id}\` = ?`);
      params.push(filters.farmId);
    }

    if (filters.plotId && columnMap.plot_id) {
      whereClauses.push(`\`${columnMap.plot_id}\` = ?`);
      params.push(filters.plotId);
    }

    const orderColumn = columnMap.timestamp || columnMap.id;
    if (!orderColumn) {
      throw new BadRequestException("La tabla telemetry no tiene una columna usable para ordenar lecturas.");
    }

    const sql = [
      `SELECT ${selectClause}`,
      `FROM \`${tableName}\``,
      whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "",
      `ORDER BY \`${orderColumn}\` DESC`,
      `LIMIT ${limit}`,
    ]
      .filter(Boolean)
      .join(" ");

    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
    const rowsWithDailyEnergy = await this.attachDailyEnergy(rows, {
      tableName,
      columnMap,
      deviceId,
      farmId: filters.farmId,
      plotId: filters.plotId,
    });

    return rowsWithDailyEnergy.map((row) => this.toTelemetryView(row));
  }

  private async attachDailyEnergy(
    rows: Array<Record<string, unknown>>,
    context: {
      tableName: string;
      columnMap: Record<LogicalColumn, string | null>;
      deviceId: string | null;
      farmId?: string;
      plotId?: string;
    },
  ) {
    if (!rows.length || !context.columnMap.timestamp || !context.columnMap.energy_delivered_wh) {
      return rows;
    }

    const dayKeys = Array.from(
      new Set(
        rows
          .map((row) => this.utcDayKey(this.normalizeTimestamp(row.timestamp)))
          .filter(Boolean),
      ),
    );

    const baselines = new Map<string, number | null>();
    for (const dayKey of dayKeys) {
      baselines.set(dayKey, await this.loadDayStartEnergyWh(dayKey, context));
    }

    return rows.map((row) => {
      const timestamp = this.normalizeTimestamp(row.timestamp);
      const dayKey = this.utcDayKey(timestamp);
      const currentEnergyWh = this.toNullableNumber(row.energy_delivered_wh);
      const baselineWh = baselines.get(dayKey) ?? null;
      const energyTodayKwh =
        currentEnergyWh === null || baselineWh === null ? null : this.toFixed6(Math.max(0, currentEnergyWh - baselineWh) / 1000);

      return {
        ...row,
        energy_today_kwh: energyTodayKwh,
      };
    });
  }

  private async loadDayStartEnergyWh(
    dayKey: string,
    context: {
      tableName: string;
      columnMap: Record<LogicalColumn, string | null>;
      deviceId: string | null;
      farmId?: string;
      plotId?: string;
    },
  ) {
    const timestampColumn = context.columnMap.timestamp;
    const energyColumn = context.columnMap.energy_delivered_wh;
    if (!timestampColumn || !energyColumn) return null;

    const startIso = new Date(`${dayKey}T00:00:00.000Z`);
    const endIso = new Date(`${dayKey}T23:59:59.999Z`);
    const whereClauses: string[] = [`\`${timestampColumn}\` >= ?`, `\`${timestampColumn}\` <= ?`];
    const params: unknown[] = [startIso, endIso];

    if (context.deviceId && context.columnMap.device_id) {
      whereClauses.push(`\`${context.columnMap.device_id}\` = ?`);
      params.push(context.deviceId);
    }

    if (context.farmId && context.columnMap.farm_id) {
      whereClauses.push(`\`${context.columnMap.farm_id}\` = ?`);
      params.push(context.farmId);
    }

    if (context.plotId && context.columnMap.plot_id) {
      whereClauses.push(`\`${context.columnMap.plot_id}\` = ?`);
      params.push(context.plotId);
    }

    const sql = [
      `SELECT \`${energyColumn}\` AS energy_delivered_wh`,
      `FROM \`${context.tableName}\``,
      `WHERE ${whereClauses.join(" AND ")}`,
      `ORDER BY \`${timestampColumn}\` ASC`,
      "LIMIT 1",
    ].join(" ");

    const rows = await this.prisma.$queryRawUnsafe<Array<{ energy_delivered_wh?: unknown }>>(sql, ...params);
    return this.toNullableNumber(rows[0]?.energy_delivered_wh);
  }

  private async getAvailableColumns() {
    if (!this.columnsCache) {
      this.columnsCache = this.loadAvailableColumns();
    }
    return this.columnsCache;
  }

  private async loadAvailableColumns() {
    const tableName = this.getTableName();
    const rows = await this.prisma.$queryRawUnsafe<Array<{ COLUMN_NAME?: string }>>(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
      tableName,
    );

    const set = new Set(
      rows
        .map((row) => String(row.COLUMN_NAME || "").trim())
        .filter(Boolean),
    );

    if (!set.size) {
      this.logger.warn(`No se encontraron columnas para la tabla telemetry '${tableName}'.`);
    }

    return set;
  }

  private resolveColumnMap(availableColumns: Set<string>) {
    const resolved = {} as Record<LogicalColumn, string | null>;

    for (const alias of Object.keys(DEFAULT_COLUMN_MAP) as LogicalColumn[]) {
      const envKey = `TELEMETRY_COL_${alias.toUpperCase()}`;
      const configured = String(process.env[envKey] || DEFAULT_COLUMN_MAP[alias]).trim();
      if (configured && availableColumns.has(configured)) {
        resolved[alias] = this.safeIdentifier(configured);
      } else {
        resolved[alias] = null;
      }
    }

    return resolved;
  }

  private getTableName() {
    return this.safeIdentifier(String(process.env.TELEMETRY_TABLE_NAME || "telemetry").trim() || "telemetry");
  }

  private safeIdentifier(value: string) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      throw new BadRequestException(`Identificador SQL invalido: ${value}`);
    }
    return value;
  }

  private toTelemetryView(row: Record<string, unknown>) {
    const deviceId = this.firstString(row.device_id) || String(process.env.TELEMETRY_DEFAULT_DEVICE_ID || "").trim() || "AE-01";
    const timestamp = this.normalizeTimestamp(row.timestamp);
    const farmId = this.firstString(row.farm_id) || String(process.env.TELEMETRY_DEFAULT_FARM_ID || "").trim() || null;
    const plotId = this.firstString(row.plot_id) || String(process.env.TELEMETRY_DEFAULT_PLOT_ID || "").trim() || null;

    const windSpeedMs = this.toNullableNumber(row.wind_speed_mps);
    const windDirectionDeg = this.normalizeDirection(this.toNullableNumber(row.wind_dir_deg));
    const batteryVoltageDcV = this.toNullableNumber(row.battery_voltage_dc_v);
    const batteryCurrentDcA = this.toNullableNumber(row.battery_current_dc_a);
    const batteryPowerW =
      this.firstFinite(row.battery_power_w) ??
      (batteryVoltageDcV !== null && batteryCurrentDcA !== null
        ? this.toFixed2(batteryVoltageDcV * batteryCurrentDcA)
        : null);
    const batterySocPct = this.toNullableNumber(row.battery_soc_pct);
    const housePowerConsumptionW = this.toNullableNumber(row.house_power_consumption_w);
    const batteryAutonomyEstimatedH =
      this.firstFinite(row.battery_autonomy_estimated_h) ??
      this.estimateAutonomyHours(batterySocPct, housePowerConsumptionW);
    const inverterOutputVoltageAcV = this.toNullableNumber(row.inverter_output_voltage_ac_v);
    const inverterOutputCurrentAcA = this.toNullableNumber(row.inverter_output_current_ac_a);
    const energyDeliveredWh = this.toNullableNumber(row.energy_delivered_wh);
    const inverterTempC = this.toNullableNumber(row.inverter_temp_c);
    const motorVibration = this.toNullableNumber(row.motor_vibration);
    const vibrationSignal = this.toNullableNumber(row.vibration_signal);
    const bladeRpm = this.toNullableNumber(row.blade_rpm);
    const batteryAlertLow = this.toNullableBoolean(row.battery_alert_low);
    const batteryAlertOverload = this.toNullableBoolean(row.battery_alert_overload);
    const batteryAlertOvertemp = this.toNullableBoolean(row.battery_alert_overtemp);
    const inverterAlertOverload = this.toNullableBoolean(row.inverter_alert_overload);
    const inverterAlertFault = this.toNullableBoolean(row.inverter_alert_fault);
    const inverterAlertSupplyCut = this.toNullableBoolean(row.inverter_alert_supply_cut);
    const source = this.resolveSource(windSpeedMs, batteryPowerW, housePowerConsumptionW);

    return {
      id: this.firstString(row.id) || `${deviceId}:${timestamp}`,
      deviceId,
      farmId,
      plotId,
      ts: timestamp,
      timestamp,
      createdAt: timestamp,
      wind_speed_mps: windSpeedMs,
      wind_dir_deg: windDirectionDeg,
      battery_voltage_dc_v: batteryVoltageDcV,
      battery_current_dc_a: batteryCurrentDcA,
      battery_power_w: batteryPowerW,
      battery_soc_pct: batterySocPct,
      battery_autonomy_estimated_h: batteryAutonomyEstimatedH,
      inverter_output_voltage_ac_v: inverterOutputVoltageAcV,
      inverter_output_current_ac_a: inverterOutputCurrentAcA,
      house_power_consumption_w: housePowerConsumptionW,
      energy_delivered_wh: energyDeliveredWh,
      inverter_temp_c: inverterTempC,
      motor_vibration: motorVibration,
      vibration_signal: vibrationSignal,
      blade_rpm: bladeRpm,
      battery_alert_low: batteryAlertLow,
      battery_alert_overload: batteryAlertOverload,
      battery_alert_overtemp: batteryAlertOvertemp,
      inverter_alert_overload: inverterAlertOverload,
      inverter_alert_fault: inverterAlertFault,
      inverter_alert_supply_cut: inverterAlertSupplyCut,
      windSpeedMs,
      windDirectionDeg,
      genVoltageV: batteryVoltageDcV,
      genCurrentA: batteryCurrentDcA,
      powerW: batteryPowerW,
      loadPowerW: housePowerConsumptionW,
      outputVoltageAcV: inverterOutputVoltageAcV,
      outputCurrentAcA: inverterOutputCurrentAcA,
      vibrationRms: motorVibration,
      vibrationSignal,
      genTempC: inverterTempC,
      rotorRpm: bladeRpm,
      batteryPct: batterySocPct,
      estimatedAutonomyHours: batteryAutonomyEstimatedH,
      energyTodayKwh:
        this.toNullableNumber(row.energy_today_kwh) ??
        (energyDeliveredWh === null ? null : this.toFixed6(energyDeliveredWh / 1000)),
      sourceNow: source.sourceNow,
      sourceReason: source.sourceReason,
      mode: "telemetry-table",
    };
  }

  private firstString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private firstFinite(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toNullableNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toNullableBoolean(value: unknown) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes", "si", "on"].includes(normalized)) return true;
      if (["0", "false", "no", "off"].includes(normalized)) return false;
    }
    return null;
  }

  private normalizeTimestamp(value: unknown) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string" && value.trim()) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    }
    return new Date().toISOString();
  }

  private utcDayKey(iso: string) {
    return iso.slice(0, 10);
  }

  private normalizeDirection(value: number | null) {
    if (value === null) return null;
    return ((value % 360) + 360) % 360;
  }

  private estimateAutonomyHours(batterySocPct: number | null, housePowerConsumptionW: number | null) {
    if (batterySocPct === null || housePowerConsumptionW === null || housePowerConsumptionW <= 0) return null;
    const capacityKwh = this.fromEnvNumber("BATTERY_CAPACITY_KWH", 4.8);
    const availableKwh = capacityKwh * (batterySocPct / 100);
    return this.toFixed2(availableKwh / (housePowerConsumptionW / 1000));
  }

  private resolveSource(windSpeedMs: number | null, batteryPowerW: number | null, housePowerConsumptionW: number | null) {
    if ((batteryPowerW ?? 0) > 60 || (windSpeedMs ?? 0) < 3) {
      return {
        sourceNow: "BATTERY" as const,
        sourceReason: "La bateria esta sosteniendo la vivienda por baja disponibilidad eolica.",
      };
    }

    if ((batteryPowerW ?? 0) < -60) {
      return {
        sourceNow: "WIND" as const,
        sourceReason: "El viento cubre la demanda y permite cargar la bateria.",
      };
    }

    return {
      sourceNow: "BOTH" as const,
      sourceReason: "El viento y la bateria comparten el suministro actual.",
    };
  }

  private fromEnvNumber(name: string, fallback: number) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private toFixed2(value: number) {
    return Number(value.toFixed(2));
  }

  private toFixed6(value: number) {
    return Number(value.toFixed(6));
  }
}
