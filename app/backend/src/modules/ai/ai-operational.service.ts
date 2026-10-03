import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaService } from "../../prisma/prisma.service";
import { mockLatestReading } from "../../mock/data";

type FaultPrediction = {
  deviceId: string | null;
  label: string | null;
  confidencePct: number | null;
  severity: "info" | "warning" | "critical";
  recommendedAction: string | null;
  timestamp: string | null;
};

type PowerForecast = {
  deviceId: string | null;
  predictedPowerW: number | null;
  lowerBoundW: number | null;
  upperBoundW: number | null;
  horizonMinutes: number | null;
  timestamp: string | null;
};

type YawRecommendation = {
  deviceId: string | null;
  targetYawDeg: number | null;
  action: string | null;
  confidencePct: number | null;
  reason: string | null;
  timestamp: string | null;
};

export type OperationalAiSnapshot = {
  deviceId: string | null;
  updatedAt: string | null;
  faultPrediction: FaultPrediction | null;
  powerForecast: PowerForecast | null;
  yawRecommendation: YawRecommendation | null;
};

type TableRow = Record<string, unknown>;

type TableDescriptor = {
  envKey: string;
  fallbackTable: string;
  deviceCandidates: string[];
  orderCandidates: string[];
};

type AiTelemetryPoint = {
  deviceId: string | null;
  timestamp: string | null;
  windSpeedMs: number | null;
  windDirectionDeg: number | null;
  powerW: number | null;
  loadPowerW: number | null;
  batteryPct: number | null;
  batteryAutonomyEstimatedH: number | null;
  genVoltageV: number | null;
  genCurrentA: number | null;
  outputVoltageAcV: number | null;
  outputCurrentAcA: number | null;
  vibrationRms: number | null;
  genTempC: number | null;
  rotorRpm: number | null;
  batteryAlertLow: boolean | null;
  batteryAlertOverload: boolean | null;
  batteryAlertOvertemp: boolean | null;
  inverterAlertOverload: boolean | null;
  inverterAlertFault: boolean | null;
  inverterAlertSupplyCut: boolean | null;
  sourceNow: string | null;
};

type LocalOperationalInference = {
  deviceId: string | null;
  updatedAt: string | null;
  faultPrediction: FaultPrediction | null;
  powerForecast: PowerForecast | null;
  yawRecommendation: YawRecommendation | null;
};

type FaultCandidate = {
  label: string;
  score: number;
  severity: "info" | "warning" | "critical";
  recommendedAction: string;
};

type OperationalModelArtifact = {
  schemaVersion: number;
  modelFamily?: string;
  features: {
    names: string[];
    means: Record<string, number>;
    stds: Record<string, number>;
    defaults?: Record<string, number>;
  };
  fault?: {
    type: string;
    classes: string[];
    weights: Record<string, number[]>;
    biases: Record<string, number>;
  };
  power?: {
    type: string;
    horizonMinutes: number;
    weights: number[];
    bias: number;
    residualStdW?: number;
    maxPowerW?: number;
  };
  yaw?: {
    type: string;
    horizonMinutes: number;
    sinWeights: number[];
    sinBias: number;
    cosWeights: number[];
    cosBias: number;
    angularMaeDeg?: number;
  };
  training?: Record<string, unknown>;
};

type OperationalModelCache = {
  path: string;
  mtimeMs: number;
  artifact: OperationalModelArtifact | null;
};

const TELEMETRY_COLUMN_CANDIDATES = {
  id: ["id"],
  deviceId: ["device_id", "deviceId"],
  timestamp: ["timestamp", "ts", "event_time", "created_at", "createdAt"],
  windSpeedMs: ["wind_speed_mps", "windSpeedMs", "wind_speed", "windSpeed"],
  windDirectionDeg: ["wind_dir_deg", "windDirectionDeg", "wind_direction_deg", "windDirection"],
  powerW: ["battery_power_w", "powerW", "power_w", "gen_power_w"],
  loadPowerW: ["house_power_consumption_w", "loadPowerW", "load_power_w", "housePowerConsumptionW"],
  batteryPct: ["battery_soc_pct", "batteryPct", "battery_pct", "stateOfChargePct"],
  batteryAutonomyEstimatedH: ["battery_autonomy_estimated_h", "batteryAutonomyEstimatedH"],
  genVoltageV: ["battery_voltage_dc_v", "genVoltageV", "batteryVoltageDcV"],
  genCurrentA: ["battery_current_dc_a", "genCurrentA", "batteryCurrentDcA"],
  outputVoltageAcV: ["inverter_output_voltage_ac_v", "outputVoltageAcV", "inverterOutputVoltageAcV"],
  outputCurrentAcA: ["inverter_output_current_ac_a", "outputCurrentAcA", "inverterOutputCurrentAcA"],
  vibrationRms: ["motor_vibration", "vibrationRms", "vibration_rms"],
  genTempC: ["inverter_temp_c", "genTempC", "generator_temp_c"],
  rotorRpm: ["blade_rpm", "rotorRpm", "rotor_rpm"],
  batteryAlertLow: ["battery_alert_low", "batteryAlertLow"],
  batteryAlertOverload: ["battery_alert_overload", "batteryAlertOverload"],
  batteryAlertOvertemp: ["battery_alert_overtemp", "batteryAlertOvertemp"],
  inverterAlertOverload: ["inverter_alert_overload", "inverterAlertOverload"],
  inverterAlertFault: ["inverter_alert_fault", "inverterAlertFault"],
  inverterAlertSupplyCut: ["inverter_alert_supply_cut", "inverterAlertSupplyCut"],
  sourceNow: ["source_now", "sourceNow"],
} as const;

type TelemetryAlias = keyof typeof TELEMETRY_COLUMN_CANDIDATES;

const TELEMETRY_ENV_BY_ALIAS: Partial<Record<TelemetryAlias, string>> = {
  deviceId: "TELEMETRY_COL_DEVICE_ID",
  timestamp: "TELEMETRY_COL_TIMESTAMP",
  windSpeedMs: "TELEMETRY_COL_WIND_SPEED_MPS",
  windDirectionDeg: "TELEMETRY_COL_WIND_DIR_DEG",
  powerW: "TELEMETRY_COL_BATTERY_POWER_W",
  loadPowerW: "TELEMETRY_COL_HOUSE_POWER_CONSUMPTION_W",
  batteryPct: "TELEMETRY_COL_BATTERY_SOC_PCT",
  batteryAutonomyEstimatedH: "TELEMETRY_COL_BATTERY_AUTONOMY_ESTIMATED_H",
  genVoltageV: "TELEMETRY_COL_BATTERY_VOLTAGE_DC_V",
  genCurrentA: "TELEMETRY_COL_BATTERY_CURRENT_DC_A",
  outputVoltageAcV: "TELEMETRY_COL_INVERTER_OUTPUT_VOLTAGE_AC_V",
  outputCurrentAcA: "TELEMETRY_COL_INVERTER_OUTPUT_CURRENT_AC_A",
  vibrationRms: "TELEMETRY_COL_MOTOR_VIBRATION",
  genTempC: "TELEMETRY_COL_INVERTER_TEMP_C",
  rotorRpm: "TELEMETRY_COL_BLADE_RPM",
  batteryAlertLow: "TELEMETRY_COL_BATTERY_ALERT_LOW",
  batteryAlertOverload: "TELEMETRY_COL_BATTERY_ALERT_OVERLOAD",
  batteryAlertOvertemp: "TELEMETRY_COL_BATTERY_ALERT_OVERTEMP",
  inverterAlertOverload: "TELEMETRY_COL_INVERTER_ALERT_OVERLOAD",
  inverterAlertFault: "TELEMETRY_COL_INVERTER_ALERT_FAULT",
  inverterAlertSupplyCut: "TELEMETRY_COL_INVERTER_ALERT_SUPPLY_CUT",
};

@Injectable()
export class AiOperationalService {
  private readonly logger = new Logger(AiOperationalService.name);
  private readonly schemaCache = new Map<string, Promise<Map<string, string>>>();
  private modelCache: OperationalModelCache | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async latest(deviceId?: string): Promise<OperationalAiSnapshot> {
    const requestedDeviceId =
      this.normalizeString(deviceId) ||
      this.normalizeString(process.env.AI_DEFAULT_DEVICE_ID) ||
      this.normalizeString(process.env.TELEMETRY_DEFAULT_DEVICE_ID);

    if (process.env.MOCK_DATA === "true") {
      const latest = mockLatestReading();
      const timestamp = latest?.ts || new Date().toISOString();
      const windSpeedMs = Number(latest?.windSpeedMs ?? 0);
      const predictedPowerW = Math.max(
        Number(latest?.housePowerConsumptionW ?? 0),
        Number((windSpeedMs * 115).toFixed(1)),
      );

      return {
        deviceId: requestedDeviceId || latest?.deviceId || null,
        updatedAt: timestamp,
        faultPrediction: {
          deviceId: requestedDeviceId || latest?.deviceId || null,
          label: "nominal_operation",
          confidencePct: 86,
          severity: "info",
          recommendedAction: "Mantener monitoreo y revisar anclajes en la siguiente inspeccion preventiva.",
          timestamp,
        },
        powerForecast: {
          deviceId: requestedDeviceId || latest?.deviceId || null,
          predictedPowerW,
          lowerBoundW: Number(Math.max(0, predictedPowerW * 0.84).toFixed(1)),
          upperBoundW: Number((predictedPowerW * 1.16).toFixed(1)),
          horizonMinutes: 15,
          timestamp,
        },
        yawRecommendation: {
          deviceId: requestedDeviceId || latest?.deviceId || null,
          targetYawDeg: Number(latest?.windDirectionDeg ?? 0),
          action: "Mantener orientacion actual; desviacion menor al margen operativo.",
          confidencePct: 91,
          reason: "Direccion de viento estable en la ventana reciente.",
          timestamp,
        },
      };
    }

    const [faultRow, powerRow, yawRow, localInference] = await Promise.all([
      this.loadLatestRow(
        {
          envKey: "AI_FAULT_TABLE_NAME",
          fallbackTable: "ai_fault_predictions",
          deviceCandidates: ["device_id", "deviceId"],
          orderCandidates: ["prediction_time", "predicted_at", "created_at", "createdAt", "timestamp", "event_time", "ts", "id"],
        },
        requestedDeviceId,
      ),
      this.loadLatestRow(
        {
          envKey: "AI_POWER_TABLE_NAME",
          fallbackTable: "ai_power_forecast",
          deviceCandidates: ["device_id", "deviceId"],
          orderCandidates: ["forecast_time", "prediction_time", "predicted_at", "created_at", "createdAt", "timestamp", "event_time", "ts", "id"],
        },
        requestedDeviceId,
      ),
      this.loadLatestRow(
        {
          envKey: "AI_YAW_TABLE_NAME",
          fallbackTable: "ai_yaw_recommendations",
          deviceCandidates: ["device_id", "deviceId"],
          orderCandidates: ["recommendation_time", "created_at", "createdAt", "timestamp", "event_time", "ts", "id"],
        },
        requestedDeviceId,
      ),
      this.localInferenceEnabled()
        ? this.buildLocalInference(requestedDeviceId)
        : Promise.resolve(null),
    ]);

    const faultPrediction = this.normalizeFaultPrediction(faultRow) || localInference?.faultPrediction || null;
    const powerForecast = this.normalizePowerForecast(powerRow) || localInference?.powerForecast || null;
    const yawRecommendation = this.normalizeYawRecommendation(yawRow) || localInference?.yawRecommendation || null;
    const resolvedDeviceId =
      faultPrediction?.deviceId ||
      powerForecast?.deviceId ||
      yawRecommendation?.deviceId ||
      localInference?.deviceId ||
      requestedDeviceId ||
      null;

    return {
      deviceId: resolvedDeviceId,
      updatedAt: this.pickLatestTimestamp(
        faultPrediction?.timestamp,
        powerForecast?.timestamp,
        yawRecommendation?.timestamp,
        localInference?.updatedAt,
      ),
      faultPrediction,
      powerForecast,
      yawRecommendation,
    };
  }

  private async buildLocalInference(deviceId: string | null): Promise<LocalOperationalInference | null> {
    const points = await this.loadRecentTelemetry(deviceId);
    if (!points.length) return null;

    const latest = points[0];
    const resolvedDeviceId = latest.deviceId || deviceId || null;
    const heuristicInference = {
      deviceId: resolvedDeviceId,
      updatedAt: latest.timestamp,
      faultPrediction: this.inferFaultPrediction(points, resolvedDeviceId),
      powerForecast: this.inferPowerForecast(points, resolvedDeviceId),
      yawRecommendation: this.inferYawRecommendation(points, resolvedDeviceId),
    };
    const modelInference = this.modelInferenceEnabled()
      ? this.inferWithOperationalModel(points, resolvedDeviceId)
      : null;

    return {
      deviceId: resolvedDeviceId,
      updatedAt: latest.timestamp,
      faultPrediction: modelInference?.faultPrediction || heuristicInference.faultPrediction,
      powerForecast: modelInference?.powerForecast || heuristicInference.powerForecast,
      yawRecommendation: modelInference?.yawRecommendation || heuristicInference.yawRecommendation,
    };
  }

  private async loadRecentTelemetry(deviceId: string | null) {
    try {
      if (this.usesTelemetryTable()) {
        return this.loadRecentExternalTelemetry(deviceId);
      }
      return this.loadRecentPrismaTelemetry(deviceId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo cargar telemetria para inferencia local: ${message}`);
      return [];
    }
  }

  private async loadRecentPrismaTelemetry(deviceId: string | null): Promise<AiTelemetryPoint[]> {
    const readings = await this.prisma.sensorReading.findMany({
      where: deviceId ? { deviceId } : {},
      orderBy: { timestamp: "desc" },
      take: this.telemetryWindowLimit(),
      select: {
        deviceId: true,
        timestamp: true,
        windSpeed: true,
        windDirectionDeg: true,
        powerW: true,
        loadPowerW: true,
        batteryPct: true,
        batteryAutonomyEstimatedH: true,
        genVoltageV: true,
        genCurrentA: true,
        outputVoltageAcV: true,
        outputCurrentAcA: true,
        vibrationRms: true,
        genTempC: true,
        rotorRpm: true,
        batteryAlertLow: true,
        batteryAlertOverload: true,
        batteryAlertOvertemp: true,
        inverterAlertOverload: true,
        inverterAlertFault: true,
        inverterAlertSupplyCut: true,
        sourceNow: true,
      },
    });

    return readings.map((reading) => ({
      deviceId: this.normalizeString(reading.deviceId),
      timestamp: this.normalizeTimestamp(reading.timestamp),
      windSpeedMs: this.toNullableNumber(reading.windSpeed),
      windDirectionDeg: this.normalizeAngle(this.toNullableNumber(reading.windDirectionDeg)),
      powerW: this.toNullableNumber(reading.powerW),
      loadPowerW: this.toNullableNumber(reading.loadPowerW),
      batteryPct: this.toNullableNumber(reading.batteryPct),
      batteryAutonomyEstimatedH: this.toNullableNumber(reading.batteryAutonomyEstimatedH),
      genVoltageV: this.toNullableNumber(reading.genVoltageV),
      genCurrentA: this.toNullableNumber(reading.genCurrentA),
      outputVoltageAcV: this.toNullableNumber(reading.outputVoltageAcV),
      outputCurrentAcA: this.toNullableNumber(reading.outputCurrentAcA),
      vibrationRms: this.toNullableNumber(reading.vibrationRms),
      genTempC: this.toNullableNumber(reading.genTempC),
      rotorRpm: this.toNullableNumber(reading.rotorRpm),
      batteryAlertLow: this.toNullableBoolean(reading.batteryAlertLow),
      batteryAlertOverload: this.toNullableBoolean(reading.batteryAlertOverload),
      batteryAlertOvertemp: this.toNullableBoolean(reading.batteryAlertOvertemp),
      inverterAlertOverload: this.toNullableBoolean(reading.inverterAlertOverload),
      inverterAlertFault: this.toNullableBoolean(reading.inverterAlertFault),
      inverterAlertSupplyCut: this.toNullableBoolean(reading.inverterAlertSupplyCut),
      sourceNow: this.normalizeString(reading.sourceNow),
    }));
  }

  private async loadRecentExternalTelemetry(deviceId: string | null): Promise<AiTelemetryPoint[]> {
    const tableName = this.getTelemetryTableName();
    const schema = await this.loadSchema(tableName);
    if (!schema.size) return [];

    const columnMap = this.resolveTelemetryColumnMap(schema);
    const orderColumn = columnMap.timestamp || columnMap.id;
    if (!orderColumn) {
      this.logger.warn(`La tabla '${tableName}' no tiene columna timestamp/id para inferencia local.`);
      return [];
    }

    const aliases = Object.keys(TELEMETRY_COLUMN_CANDIDATES) as TelemetryAlias[];
    const selectClause = aliases
      .map((alias) => {
        const column = columnMap[alias];
        return column ? `\`${column}\` AS \`${alias}\`` : `NULL AS \`${alias}\``;
      })
      .join(", ");

    const whereClauses: string[] = [];
    const params: unknown[] = [];
    if (deviceId && columnMap.deviceId) {
      whereClauses.push(`\`${columnMap.deviceId}\` = ?`);
      params.push(deviceId);
    }

    const sql = [
      `SELECT ${selectClause}`,
      `FROM \`${tableName}\``,
      whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "",
      `ORDER BY \`${orderColumn}\` DESC`,
      `LIMIT ${this.telemetryWindowLimit()}`,
    ]
      .filter(Boolean)
      .join(" ");

    const rows = await this.prisma.$queryRawUnsafe<TableRow[]>(sql, ...params);
    return rows.map((row) => this.mapTelemetryAliasRow(row));
  }

  private resolveTelemetryColumnMap(schema: Map<string, string>) {
    const resolved = {} as Record<TelemetryAlias, string | null>;

    for (const alias of Object.keys(TELEMETRY_COLUMN_CANDIDATES) as TelemetryAlias[]) {
      const envKey = TELEMETRY_ENV_BY_ALIAS[alias];
      const configured = envKey ? this.normalizeString(process.env[envKey]) : null;
      const candidates = configured
        ? [configured, ...TELEMETRY_COLUMN_CANDIDATES[alias]]
        : [...TELEMETRY_COLUMN_CANDIDATES[alias]];
      const match = this.pickExistingColumn(schema, candidates);
      resolved[alias] = match ? this.safeIdentifier(match) : null;
    }

    return resolved;
  }

  private mapTelemetryAliasRow(row: TableRow): AiTelemetryPoint {
    const timestamp = this.normalizeTimestamp(row.timestamp);
    return {
      deviceId: this.normalizeString(row.deviceId),
      timestamp,
      windSpeedMs: this.toNullableNumber(row.windSpeedMs),
      windDirectionDeg: this.normalizeAngle(this.toNullableNumber(row.windDirectionDeg)),
      powerW: this.toNullableNumber(row.powerW),
      loadPowerW: this.toNullableNumber(row.loadPowerW),
      batteryPct: this.toNullableNumber(row.batteryPct),
      batteryAutonomyEstimatedH: this.toNullableNumber(row.batteryAutonomyEstimatedH),
      genVoltageV: this.toNullableNumber(row.genVoltageV),
      genCurrentA: this.toNullableNumber(row.genCurrentA),
      outputVoltageAcV: this.toNullableNumber(row.outputVoltageAcV),
      outputCurrentAcA: this.toNullableNumber(row.outputCurrentAcA),
      vibrationRms: this.toNullableNumber(row.vibrationRms),
      genTempC: this.toNullableNumber(row.genTempC),
      rotorRpm: this.toNullableNumber(row.rotorRpm),
      batteryAlertLow: this.toNullableBoolean(row.batteryAlertLow),
      batteryAlertOverload: this.toNullableBoolean(row.batteryAlertOverload),
      batteryAlertOvertemp: this.toNullableBoolean(row.batteryAlertOvertemp),
      inverterAlertOverload: this.toNullableBoolean(row.inverterAlertOverload),
      inverterAlertFault: this.toNullableBoolean(row.inverterAlertFault),
      inverterAlertSupplyCut: this.toNullableBoolean(row.inverterAlertSupplyCut),
      sourceNow: this.normalizeString(row.sourceNow),
    };
  }

  private inferWithOperationalModel(points: AiTelemetryPoint[], deviceId: string | null): LocalOperationalInference | null {
    const model = this.loadOperationalModel();
    if (!model) return null;

    const latest = points[0];
    const timestamp = latest.timestamp || new Date().toISOString();
    const vector = this.buildModelFeatureVector(model, points);

    return {
      deviceId,
      updatedAt: timestamp,
      faultPrediction: this.predictFaultWithModel(model, vector, points, deviceId, timestamp),
      powerForecast: this.predictPowerWithModel(model, vector, deviceId, timestamp),
      yawRecommendation: this.predictYawWithModel(model, vector, points, deviceId, timestamp),
    };
  }

  private predictFaultWithModel(
    model: OperationalModelArtifact,
    vector: number[],
    points: AiTelemetryPoint[],
    deviceId: string | null,
    timestamp: string,
  ): FaultPrediction | null {
    const fault = model.fault;
    if (!fault || fault.type !== "softmax_classifier" || !fault.classes?.length) return null;

    const probabilities = this.softmax(
      fault.classes.map((className) => (fault.biases?.[className] ?? 0) + this.dot(fault.weights?.[className] || [], vector)),
    );
    const winner = fault.classes
      .map((label, index) => ({ label, probability: probabilities[index] || 0 }))
      .sort((left, right) => right.probability - left.probability)[0];
    if (!winner) return null;

    const confidencePct = Number(
      this.clamp(winner.probability * 100, winner.label === "nominal_operation" ? 65 : 55, 99).toFixed(1),
    );

    return {
      deviceId,
      label: winner.label,
      confidencePct,
      severity: this.modelSeverity(winner.label, points[0], confidencePct),
      recommendedAction: this.modelRecommendedAction(winner.label),
      timestamp,
    };
  }

  private predictPowerWithModel(
    model: OperationalModelArtifact,
    vector: number[],
    deviceId: string | null,
    timestamp: string,
  ): PowerForecast | null {
    const power = model.power;
    if (!power || power.type !== "ridge_regression" || !Array.isArray(power.weights)) return null;

    const maxPowerW = power.maxPowerW || this.readEnvNumber("AI_MAX_POWER_W", 5000);
    const predictedPowerW = Number(this.clamp(power.bias + this.dot(power.weights, vector), 0, maxPowerW).toFixed(1));
    const spread = Math.max(60, (power.residualStdW || 120) * 1.15, predictedPowerW * 0.12);

    return {
      deviceId,
      predictedPowerW,
      lowerBoundW: Number(Math.max(0, predictedPowerW - spread).toFixed(1)),
      upperBoundW: Number(Math.min(maxPowerW, predictedPowerW + spread).toFixed(1)),
      horizonMinutes: power.horizonMinutes || this.readEnvNumber("AI_FORECAST_HORIZON_MINUTES", 15),
      timestamp,
    };
  }

  private predictYawWithModel(
    model: OperationalModelArtifact,
    vector: number[],
    points: AiTelemetryPoint[],
    deviceId: string | null,
    timestamp: string,
  ): YawRecommendation | null {
    const yaw = model.yaw;
    if (!yaw || yaw.type !== "circular_ridge_regression") return null;

    const sin = yaw.sinBias + this.dot(yaw.sinWeights || [], vector);
    const cos = yaw.cosBias + this.dot(yaw.cosWeights || [], vector);
    if (Math.abs(sin) < 0.000001 && Math.abs(cos) < 0.000001) return null;

    const targetYawDeg = this.normalizeAngle((Math.atan2(sin, cos) * 180) / Math.PI);
    if (targetYawDeg === null) return null;

    const recent = points.slice(0, 30);
    const directions = recent
      .map((point) => point.windDirectionDeg)
      .filter((value): value is number => value !== null);
    const spread = this.circularSpreadDeg(directions, targetYawDeg);
    const windAvg = this.average(this.numbers(recent, (point) => point.windSpeedMs, 30)) ?? 0;
    const confidencePct = Number(
      this.clamp(92 - (yaw.angularMaeDeg || 20) * 0.75 - spread * 0.25 + Math.min(windAvg * 1.2, 8), 45, 94).toFixed(1),
    );

    return this.buildYawRecommendation({
      deviceId,
      timestamp,
      targetYawDeg,
      confidencePct,
      windAvg,
      spread,
    });
  }

  private buildYawRecommendation(input: {
    deviceId: string | null;
    timestamp: string;
    targetYawDeg: number;
    confidencePct: number;
    windAvg: number;
    spread: number;
  }): YawRecommendation {
    const targetLabel = `${input.targetYawDeg.toFixed(0)} grados`;

    if (input.windAvg < 2) {
      return {
        deviceId: input.deviceId,
        targetYawDeg: input.targetYawDeg,
        action: "Mantener orientacion actual; viento bajo y poca ganancia esperada por correccion de yaw.",
        confidencePct: input.confidencePct,
        reason: "La velocidad de viento reciente no justifica ajustes agresivos.",
        timestamp: input.timestamp,
      };
    }

    if (input.spread <= 15) {
      return {
        deviceId: input.deviceId,
        targetYawDeg: input.targetYawDeg,
        action: `Orientar rotor hacia ${targetLabel} para capturar el frente de viento dominante.`,
        confidencePct: input.confidencePct,
        reason: "Direccion de viento estable en la ventana reciente.",
        timestamp: input.timestamp,
      };
    }

    if (input.spread <= 35) {
      return {
        deviceId: input.deviceId,
        targetYawDeg: input.targetYawDeg,
        action: `Ajustar gradualmente hacia ${targetLabel} y confirmar estabilidad antes de fijar posicion.`,
        confidencePct: input.confidencePct,
        reason: "Direccion de viento moderadamente variable.",
        timestamp: input.timestamp,
      };
    }

    return {
      deviceId: input.deviceId,
      targetYawDeg: input.targetYawDeg,
      action: "Evitar correcciones bruscas de yaw; esperar una direccion de viento mas estable.",
      confidencePct: input.confidencePct,
      reason: "Viento variable con dispersion alta en la ventana reciente.",
      timestamp: input.timestamp,
    };
  }

  private buildModelFeatureVector(model: OperationalModelArtifact, points: AiTelemetryPoint[]) {
    const featureMap = this.buildModelFeatureMap(points);
    return model.features.names.map((name) => {
      const raw = featureMap[name] ?? model.features.defaults?.[name] ?? 0;
      const mean = model.features.means?.[name] ?? 0;
      const std = model.features.stds?.[name] || 1;
      return (raw - mean) / std;
    });
  }

  private buildModelFeatureMap(points: AiTelemetryPoint[]): Record<string, number> {
    const latest = points[0];
    const recent = points.slice(0, 30);
    const windDirectionDeg = latest.windDirectionDeg ?? 0;
    const outputPowerW =
      latest.outputVoltageAcV !== null && latest.outputCurrentAcA !== null
        ? Math.max(0, latest.outputVoltageAcV * latest.outputCurrentAcA)
        : 0;
    const directions = recent
      .map((point) => point.windDirectionDeg)
      .filter((value): value is number => value !== null);
    const windMean = this.circularMeanDeg(directions);

    return {
      windSpeedMs: latest.windSpeedMs ?? 0,
      windDirectionSin: Math.sin((windDirectionDeg * Math.PI) / 180),
      windDirectionCos: Math.cos((windDirectionDeg * Math.PI) / 180),
      powerW: this.effectivePowerW(latest) ?? 0,
      loadPowerW: latest.loadPowerW ?? 0,
      batteryPct: latest.batteryPct ?? 0,
      batteryAutonomyEstimatedH: latest.batteryAutonomyEstimatedH ?? 0,
      genVoltageV: latest.genVoltageV ?? 0,
      genCurrentA: latest.genCurrentA ?? 0,
      outputVoltageAcV: latest.outputVoltageAcV ?? 0,
      outputCurrentAcA: latest.outputCurrentAcA ?? 0,
      outputPowerW,
      vibrationRms: latest.vibrationRms ?? 0,
      genTempC: latest.genTempC ?? 0,
      rotorRpm: latest.rotorRpm ?? 0,
      tempSlopePerMin: this.slopePerMinute(points, (point) => point.genTempC, 30),
      vibrationSlopePerMin: this.slopePerMinute(points, (point) => point.vibrationRms, 30),
      batterySlopePerMin: this.slopePerMinute(points, (point) => point.batteryPct, 30),
      powerSlopePerMin: this.slopePerMinute(points, (point) => this.effectivePowerW(point), 30),
      windAvg: this.average(this.numbers(recent, (point) => point.windSpeedMs, 30)) ?? 0,
      windStd: this.stdDev(this.numbers(recent, (point) => point.windSpeedMs, 30)),
      directionSpreadDeg: windMean === null ? 180 : this.circularSpreadDeg(directions, windMean),
      powerAvg: this.average(this.numbers(recent, (point) => this.effectivePowerW(point), 30)) ?? 0,
      loadAvg: this.average(this.numbers(recent, (point) => point.loadPowerW, 30)) ?? 0,
      rotorRpmAvg: this.average(this.numbers(recent, (point) => point.rotorRpm, 30)) ?? 0,
      lowBatteryFlag: latest.batteryAlertLow ? 1 : 0,
      overloadFlag: latest.batteryAlertOverload || latest.batteryAlertOvertemp || latest.inverterAlertOverload ? 1 : 0,
      inverterFaultFlag: latest.inverterAlertFault ? 1 : 0,
      supplyCutFlag: latest.inverterAlertSupplyCut ? 1 : 0,
    };
  }

  private loadOperationalModel(): OperationalModelArtifact | null {
    const modelPath = this.resolveModelPath();
    if (!fs.existsSync(modelPath)) return null;

    try {
      const stats = fs.statSync(modelPath);
      if (this.modelCache?.path === modelPath && this.modelCache.mtimeMs === stats.mtimeMs) {
        return this.modelCache.artifact;
      }

      const parsed = JSON.parse(fs.readFileSync(modelPath, "utf8")) as unknown;
      const artifact = this.isOperationalModelArtifact(parsed) ? parsed : null;
      this.modelCache = { path: modelPath, mtimeMs: stats.mtimeMs, artifact };
      if (!artifact) {
        this.logger.warn(`Modelo IA invalido en ${modelPath}; se usara fallback heuristico.`);
      } else {
        this.logger.log(`Modelo IA operativa cargado: ${modelPath}`);
      }
      return artifact;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo cargar modelo IA operativa: ${message}`);
      this.modelCache = { path: modelPath, mtimeMs: -1, artifact: null };
      return null;
    }
  }

  private isOperationalModelArtifact(value: unknown): value is OperationalModelArtifact {
    const model = value as OperationalModelArtifact | null;
    return Boolean(
      model &&
        model.schemaVersion === 1 &&
        model.features &&
        Array.isArray(model.features.names) &&
        model.features.means &&
        model.features.stds,
    );
  }

  private resolveModelPath() {
    const raw = this.normalizeString(process.env.AI_MODEL_PATH) || "models/operational-ai/operational-ai-models.json";
    return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  }

  private modelInferenceEnabled() {
    return String(process.env.AI_MODEL_INFERENCE_ENABLED ?? "true")
      .trim()
      .toLowerCase() !== "false";
  }

  private modelSeverity(label: string, latest: AiTelemetryPoint, confidencePct: number) {
    if (label === "nominal_operation") return "info" as const;
    if (label === "high_temp") {
      return (latest.genTempC ?? 0) >= this.readEnvNumber("ALERT_GEN_TEMP_HIGH_C", 70) || confidencePct >= 90
        ? "critical"
        : "warning";
    }
    if (label === "high_vibration") {
      return (latest.vibrationRms ?? 0) >= this.readEnvNumber("ALERT_VIBRATION_HIGH_RMS", 6) || confidencePct >= 92
        ? "critical"
        : "warning";
    }
    if (label === "low_battery") {
      return (latest.batteryPct ?? 100) <= this.readEnvNumber("ALERT_BATTERY_CRITICAL_PCT", 10)
        ? "critical"
        : "warning";
    }
    if (label === "overload") {
      const voltageLow = latest.outputVoltageAcV !== null && latest.outputVoltageAcV < this.readEnvNumber("ALERT_AC_VOLTAGE_LOW_V", 190);
      return latest.inverterAlertFault || latest.inverterAlertSupplyCut || voltageLow || confidencePct >= 90
        ? "critical"
        : "warning";
    }
    return "warning" as const;
  }

  private modelRecommendedAction(label: string) {
    if (label === "high_temp") {
      return "Reducir carga, revisar ventilacion del inversor y validar temperatura antes de volver a exigir el sistema.";
    }
    if (label === "high_vibration") {
      return "Inspeccionar aspas, soportes y conjunto rotativo antes de mantener operacion prolongada.";
    }
    if (label === "low_battery") {
      return "Reducir consumo no critico y priorizar recarga antes de que el sistema se apague.";
    }
    if (label === "overload") {
      return "Desconectar cargas no criticas, revisar protecciones y validar salida del inversor.";
    }
    return "Mantener monitoreo y conservar la rutina preventiva de inspeccion mecanica y electrica.";
  }

  private inferFaultPrediction(points: AiTelemetryPoint[], deviceId: string | null): FaultPrediction {
    const latest = points[0];
    const timestamp = latest.timestamp || new Date().toISOString();
    const candidates: FaultCandidate[] = [];
    const thresholds = {
      tempHighC: this.readEnvNumber("ALERT_GEN_TEMP_HIGH_C", 70),
      vibrationHighRms: this.readEnvNumber("ALERT_VIBRATION_HIGH_RMS", 6),
      batteryLowPct: this.readEnvNumber("ALERT_BATTERY_LOW_PCT", 20),
      batteryCriticalPct: this.readEnvNumber("ALERT_BATTERY_CRITICAL_PCT", 10),
      housePowerHighW: this.readEnvNumber("ALERT_HOUSE_POWER_HIGH_W", 2200),
      acCurrentHighA: this.readEnvNumber("ALERT_AC_CURRENT_HIGH_A", 12),
      acVoltageLowV: this.readEnvNumber("ALERT_AC_VOLTAGE_LOW_V", 190),
      batteryCurrentHighA: this.readEnvNumber("ALERT_BATTERY_DC_HIGH_A", 24),
      rotorRpmHigh: this.readEnvNumber("ALERT_ROTOR_RPM_HIGH", 750),
      windDangerMs: this.readEnvNumber("ALERT_WIND_DANGEROUS_MS", 20),
    };

    const latestTemp = latest.genTempC;
    const tempPeak = this.maxNumber(this.numbers(points, (point) => point.genTempC, 20));
    const tempSlope = this.slopePerMinute(points, (point) => point.genTempC, 20);
    if (latestTemp !== null || tempPeak !== null) {
      const tempStress = Math.max(latestTemp ?? 0, tempPeak ?? 0) / thresholds.tempHighC;
      if ((latestTemp ?? 0) >= thresholds.tempHighC) {
        candidates.push({
          label: "high_temp",
          score: this.clamp(91 + (tempStress - 1) * 22, 91, 99),
          severity: "critical",
          recommendedAction: "Reducir carga, revisar ventilacion del inversor y validar temperatura antes de volver a exigir el sistema.",
        });
      } else if (tempStress >= 0.82 || tempSlope >= 0.35) {
        candidates.push({
          label: "high_temp",
          score: this.clamp(66 + tempStress * 23 + Math.max(0, tempSlope) * 8, 70, 88),
          severity: "warning",
          recommendedAction: "Programar revision preventiva de ventilacion, disipadores y carga conectada.",
        });
      }
    }

    const latestVibration = latest.vibrationRms;
    const vibrationPeak = this.maxNumber(this.numbers(points, (point) => point.vibrationRms, 20));
    const vibrationSlope = this.slopePerMinute(points, (point) => point.vibrationRms, 20);
    if (latestVibration !== null || vibrationPeak !== null) {
      const vibrationStress = Math.max(latestVibration ?? 0, vibrationPeak ?? 0) / thresholds.vibrationHighRms;
      const rotorStress = (latest.rotorRpm ?? 0) / thresholds.rotorRpmHigh;
      const windStress = (latest.windSpeedMs ?? 0) / thresholds.windDangerMs;
      if ((latestVibration ?? 0) >= thresholds.vibrationHighRms || rotorStress >= 1) {
        candidates.push({
          label: "high_vibration",
          score: this.clamp(88 + Math.max(vibrationStress - 1, rotorStress - 1, 0) * 18, 88, 98),
          severity: vibrationStress >= 1.15 || rotorStress >= 1.05 ? "critical" : "warning",
          recommendedAction: "Inspeccionar aspas, soportes y conjunto rotativo antes de mantener operacion prolongada.",
        });
      } else if (vibrationStress >= 0.68 || vibrationSlope >= 0.08 || (windStress >= 0.9 && rotorStress >= 0.85)) {
        candidates.push({
          label: "high_vibration",
          score: this.clamp(67 + vibrationStress * 24 + Math.max(0, rotorStress - 0.7) * 10, 70, 87),
          severity: "warning",
          recommendedAction: "Revisar aprietes y balance del rotor en la siguiente ventana de mantenimiento.",
        });
      }
    }

    const batteryPct = latest.batteryPct;
    const batterySlope = this.slopePerMinute(points, (point) => point.batteryPct, 20);
    if (batteryPct !== null) {
      if (latest.batteryAlertLow || batteryPct <= thresholds.batteryCriticalPct) {
        candidates.push({
          label: "low_battery",
          score: this.clamp(94 + (thresholds.batteryCriticalPct - batteryPct) * 1.5, 94, 99),
          severity: "critical",
          recommendedAction: "Reducir consumo no critico y priorizar recarga antes de que el sistema se apague.",
        });
      } else if (batteryPct <= thresholds.batteryLowPct || (batteryPct <= thresholds.batteryLowPct + 12 && batterySlope <= -0.12)) {
        candidates.push({
          label: "low_battery",
          score: this.clamp(73 + (thresholds.batteryLowPct + 12 - batteryPct) * 1.1 + Math.abs(Math.min(0, batterySlope)) * 18, 74, 90),
          severity: "warning",
          recommendedAction: "Reducir carga de la vivienda y monitorear autonomia de bateria.",
        });
      }
    }

    const loadStress = (latest.loadPowerW ?? 0) / thresholds.housePowerHighW;
    const acCurrentStress = (latest.outputCurrentAcA ?? 0) / thresholds.acCurrentHighA;
    const batteryCurrentStress = Math.abs(latest.genCurrentA ?? 0) / thresholds.batteryCurrentHighA;
    const voltageLow = latest.outputVoltageAcV !== null && latest.outputVoltageAcV < thresholds.acVoltageLowV;
    const overloadFlag = Boolean(
      latest.batteryAlertOverload ||
      latest.batteryAlertOvertemp ||
      latest.inverterAlertOverload ||
      latest.inverterAlertFault ||
      latest.inverterAlertSupplyCut,
    );
    const overloadStress = Math.max(loadStress, acCurrentStress, batteryCurrentStress);
    if (overloadFlag || voltageLow || overloadStress >= 1) {
      candidates.push({
        label: "overload",
        score: this.clamp(89 + Math.max(overloadStress - 1, 0) * 12 + (voltageLow ? 5 : 0), 89, 99),
        severity: overloadFlag || voltageLow ? "critical" : "warning",
        recommendedAction: "Desconectar cargas no criticas, revisar protecciones y validar salida del inversor.",
      });
    } else if (overloadStress >= 0.82) {
      candidates.push({
        label: "overload",
        score: this.clamp(68 + overloadStress * 18, 72, 88),
        severity: "warning",
        recommendedAction: "No aumentar carga conectada y revisar consumo de la vivienda.",
      });
    }

    const winner = candidates.sort((left, right) => right.score - left.score)[0];
    if (winner) {
      return {
        deviceId,
        label: winner.label,
        confidencePct: Number(winner.score.toFixed(1)),
        severity: winner.severity,
        recommendedAction: winner.recommendedAction,
        timestamp,
      };
    }

    return {
      deviceId,
      label: "nominal_operation",
      confidencePct: this.nominalConfidence(points),
      severity: "info",
      recommendedAction: "Mantener monitoreo y conservar la rutina preventiva de inspeccion mecanica y electrica.",
      timestamp,
    };
  }

  private inferPowerForecast(points: AiTelemetryPoint[], deviceId: string | null): PowerForecast | null {
    const latest = points[0];
    const timestamp = latest.timestamp || new Date().toISOString();
    const horizonMinutes = Math.max(1, Math.min(this.readEnvNumber("AI_FORECAST_HORIZON_MINUTES", 15), 180));
    const powerValues = this.numbers(points, (point) => this.effectivePowerW(point), 30);
    const windValues = this.numbers(points, (point) => point.windSpeedMs, 30);
    const latestPower = this.effectivePowerW(latest);
    const avgPower = this.average(powerValues);
    const avgWind = this.average(windValues);
    const latestWind = latest.windSpeedMs ?? avgWind;

    if (latestPower === null && avgPower === null && latestWind === null) {
      return null;
    }

    const calibrationFactors = points
      .map((point) => {
        const power = this.effectivePowerW(point);
        const wind = point.windSpeedMs;
        if (power === null || wind === null || wind < 1.5 || power < 20) return null;
        return this.clamp(power / Math.pow(wind, 3), 3, 70);
      })
      .filter((value): value is number => value !== null);
    const windCalibration = this.median(calibrationFactors);
    const windEstimate =
      latestWind === null
        ? null
        : windCalibration !== null
          ? windCalibration * Math.pow(latestWind, 3)
          : latestWind * 115;

    const measuredBaseline = latestPower ?? avgPower ?? windEstimate ?? 0;
    const averageBaseline = avgPower ?? measuredBaseline;
    const windBaseline = windEstimate ?? measuredBaseline;
    const trend = this.slopePerMinute(points, (point) => this.effectivePowerW(point), 30) * horizonMinutes * 0.35;
    const maxTrend = Math.max(120, measuredBaseline * 0.35);
    const predictedRaw =
      measuredBaseline * 0.45 +
      averageBaseline * 0.3 +
      windBaseline * 0.25 +
      this.clamp(trend, -maxTrend, maxTrend);
    const maxPowerW = this.readEnvNumber("AI_MAX_POWER_W", 5000);
    const predictedPowerW = Number(this.clamp(predictedRaw, 0, maxPowerW).toFixed(1));
    const spread = Math.max(
      60,
      predictedPowerW * 0.16,
      this.stdDev(powerValues) * 1.35,
      this.stdDev(windValues) * 90,
    );

    return {
      deviceId,
      predictedPowerW,
      lowerBoundW: Number(Math.max(0, predictedPowerW - spread).toFixed(1)),
      upperBoundW: Number(Math.min(maxPowerW, predictedPowerW + spread).toFixed(1)),
      horizonMinutes,
      timestamp,
    };
  }

  private inferYawRecommendation(points: AiTelemetryPoint[], deviceId: string | null): YawRecommendation | null {
    const latest = points[0];
    const timestamp = latest.timestamp || new Date().toISOString();
    const recent = points.slice(0, 30);
    const windAwareDirections = recent
      .filter((point) => point.windDirectionDeg !== null && (point.windSpeedMs === null || point.windSpeedMs >= 1.5))
      .map((point) => point.windDirectionDeg as number);
    const directions = windAwareDirections.length
      ? windAwareDirections
      : recent
          .map((point) => point.windDirectionDeg)
          .filter((value): value is number => value !== null);
    const targetYawDeg = this.circularMeanDeg(directions);
    if (targetYawDeg === null) return null;

    const spread = this.circularSpreadDeg(directions, targetYawDeg);
    const windAvg = this.average(this.numbers(recent, (point) => point.windSpeedMs, 30)) ?? 0;
    const confidencePct = Number(
      this.clamp(91 - spread * 0.85 + Math.min(windAvg * 2.2, 10) + Math.min(directions.length, 20) * 0.25, 45, 94).toFixed(1),
    );
    const targetLabel = `${targetYawDeg.toFixed(0)} grados`;

    if (windAvg < 2) {
      return {
        deviceId,
        targetYawDeg,
        action: "Mantener orientacion actual; viento bajo y poca ganancia esperada por correccion de yaw.",
        confidencePct,
        reason: "La velocidad de viento reciente no justifica ajustes agresivos.",
        timestamp,
      };
    }

    if (spread <= 15) {
      return {
        deviceId,
        targetYawDeg,
        action: `Orientar rotor hacia ${targetLabel} para capturar el frente de viento dominante.`,
        confidencePct,
        reason: "Direccion de viento estable en la ventana reciente.",
        timestamp,
      };
    }

    if (spread <= 35) {
      return {
        deviceId,
        targetYawDeg,
        action: `Ajustar gradualmente hacia ${targetLabel} y confirmar estabilidad antes de fijar posicion.`,
        confidencePct,
        reason: "Direccion de viento moderadamente variable.",
        timestamp,
      };
    }

    return {
      deviceId,
      targetYawDeg,
      action: "Evitar correcciones bruscas de yaw; esperar una direccion de viento mas estable.",
      confidencePct,
      reason: "Viento variable con dispersion alta en la ventana reciente.",
      timestamp,
    };
  }

  private async loadLatestRow(descriptor: TableDescriptor, deviceId: string | null) {
    const tableName = this.getTableName(descriptor.envKey, descriptor.fallbackTable);
    const schema = await this.loadSchema(tableName);
    if (!schema.size) return null;

    const deviceColumn = this.pickExistingColumn(schema, descriptor.deviceCandidates);
    const orderColumn = this.pickExistingColumn(schema, descriptor.orderCandidates);
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (deviceId && deviceColumn) {
      whereClauses.push(`\`${deviceColumn}\` = ?`);
      params.push(deviceId);
    }

    const sql = [
      `SELECT * FROM \`${tableName}\``,
      whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "",
      orderColumn ? `ORDER BY \`${orderColumn}\` DESC` : "",
      "LIMIT 1",
    ]
      .filter(Boolean)
      .join(" ");

    try {
      const rows = await this.prisma.$queryRawUnsafe<TableRow[]>(sql, ...params);
      return rows[0] ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo consultar ${tableName}: ${message}`);
      return null;
    }
  }

  private async loadSchema(tableName: string) {
    if (!this.schemaCache.has(tableName)) {
      this.schemaCache.set(tableName, this.fetchSchema(tableName));
    }
    return this.schemaCache.get(tableName)!;
  }

  private async fetchSchema(tableName: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ COLUMN_NAME?: string }>>(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
      tableName,
    );

    const schema = new Map<string, string>();
    for (const row of rows) {
      const name = this.normalizeString(row.COLUMN_NAME);
      if (!name) continue;
      schema.set(name.toLowerCase(), name);
    }

    if (!schema.size) {
      this.logger.warn(`La tabla o vista '${tableName}' no fue encontrada en la base actual.`);
    }

    return schema;
  }

  private normalizeFaultPrediction(row: TableRow | null): FaultPrediction | null {
    if (!row) return null;

    const riskLevel = this.normalizeString(
      this.pickRowValue(row, ["risk_level", "severity", "level", "priority"]),
    );
    const label = this.normalizeString(
      this.pickRowValue(row, [
        "top_reason",
        "reason",
        "root_cause",
        "fault_label",
        "predicted_fault",
        "prediction_label",
        "fault_type",
        "class_name",
        "predicted_label",
        "fault",
        "label",
        "prediction",
      ]),
    );
    const confidencePct = this.normalizePercent(
      this.pickNullableNumber(row, [
        "risk_score",
        "confidence_pct",
        "confidence_score",
        "confidence",
        "probability",
        "score",
        "prediction_probability",
        "fault_probability",
      ]),
    );
    const recommendedAction = this.normalizeString(
      this.pickRowValue(row, [
        "recommended_action",
        "action",
        "recommendation",
        "recommended_step",
        "maintenance_action",
        "next_step",
        "recommended_response",
      ]),
    );
    const timestamp = this.normalizeTimestamp(
      this.pickRowValue(row, [
        "prediction_time",
        "prediction_timestamp",
        "predicted_at",
        "created_at",
        "createdAt",
        "timestamp",
        "event_time",
        "ts",
      ]),
    );
    const severity = this.normalizeSeverity(
      riskLevel,
      label,
      confidencePct,
    );
    const deviceId = this.normalizeString(this.pickRowValue(row, ["device_id", "deviceId"]));

    if (!label && !recommendedAction && confidencePct === null && !timestamp) {
      return null;
    }

    return {
      deviceId,
      label,
      confidencePct,
      severity,
      recommendedAction,
      timestamp,
    };
  }

  private normalizePowerForecast(row: TableRow | null): PowerForecast | null {
    if (!row) return null;

    const predictedPowerW =
      this.pickNullableNumber(row, [
        "pred_power",
        "predicted_power",
        "predicted_power_w",
        "power_forecast_w",
        "forecast_power_w",
        "prediction_w",
        "predicted_w",
        "forecast_w",
        "power_w",
      ]) ??
      this.scaleKwToW(
        this.pickNullableNumber(row, [
          "predicted_power_kw",
          "power_forecast_kw",
          "forecast_power_kw",
          "prediction_kw",
          "predicted_kw",
          "forecast_kw",
          "power_kw",
        ]),
      );
    const lowerBoundW =
      this.pickNullableNumber(row, [
        "pred_power_lower",
        "lower_bound_w",
        "prediction_lower_w",
        "lower_w",
        "min_power_w",
      ]) ??
      this.scaleKwToW(
        this.pickNullableNumber(row, [
          "lower_bound_kw",
          "prediction_lower_kw",
          "lower_kw",
          "min_power_kw",
        ]),
      );
    const upperBoundW =
      this.pickNullableNumber(row, [
        "pred_power_upper",
        "upper_bound_w",
        "prediction_upper_w",
        "upper_w",
        "max_power_w",
      ]) ??
      this.scaleKwToW(
        this.pickNullableNumber(row, [
          "upper_bound_kw",
          "prediction_upper_kw",
          "upper_kw",
          "max_power_kw",
        ]),
      );
    const horizonMinutes = this.pickNullableNumber(row, [
      "horizon_minutes",
      "forecast_horizon_min",
      "horizon_min",
      "window_minutes",
      "minutes_ahead",
      "lead_minutes",
    ]);
    const timestamp = this.normalizeTimestamp(
      this.pickRowValue(row, [
        "forecast_time",
        "forecast_timestamp",
        "prediction_time",
        "predicted_at",
        "created_at",
        "createdAt",
        "timestamp",
        "event_time",
        "ts",
      ]),
    );
    const deviceId = this.normalizeString(this.pickRowValue(row, ["device_id", "deviceId"]));

    if (predictedPowerW === null && lowerBoundW === null && upperBoundW === null && horizonMinutes === null) {
      return null;
    }

    return {
      deviceId,
      predictedPowerW,
      lowerBoundW,
      upperBoundW,
      horizonMinutes,
      timestamp,
    };
  }

  private normalizeYawRecommendation(row: TableRow | null): YawRecommendation | null {
    if (!row) return null;

    const targetYawDeg = this.normalizeAngle(
      this.pickNullableNumber(row, [
        "recommended_yaw_angle",
        "recommended_yaw_angle_deg",
        "recommended_yaw_deg",
        "target_yaw_deg",
        "yaw_target_deg",
        "yaw_deg",
        "recommended_angle_deg",
        "target_angle_deg",
      ]),
    );
    const action = this.normalizeString(
      this.pickRowValue(row, ["action", "recommended_action", "recommendation", "next_action"]),
    );
    const reason = this.normalizeString(
      this.pickRowValue(row, ["reason", "rationale", "explanation", "note", "details"]),
    );
    const confidencePct = this.normalizePercent(
      this.pickNullableNumber(row, [
        "confidence_score",
        "confidence_pct",
        "confidence",
        "probability",
        "score",
      ]),
    );
    const timestamp = this.normalizeTimestamp(
      this.pickRowValue(row, [
        "recommendation_time",
        "recommendation_timestamp",
        "created_at",
        "createdAt",
        "timestamp",
        "event_time",
        "ts",
      ]),
    );
    const deviceId = this.normalizeString(this.pickRowValue(row, ["device_id", "deviceId"]));

    if (targetYawDeg === null && !action && !reason && confidencePct === null) {
      return null;
    }

    return {
      deviceId,
      targetYawDeg,
      action,
      confidencePct,
      reason,
      timestamp,
    };
  }

  private pickExistingColumn(schema: Map<string, string>, candidates: string[]) {
    for (const candidate of candidates) {
      const match = schema.get(candidate.toLowerCase());
      if (match) return match;
    }
    return null;
  }

  private pickRowValue(row: TableRow, candidates: string[]) {
    const lookup = this.rowLookup(row);
    for (const candidate of candidates) {
      if (lookup.has(candidate.toLowerCase())) {
        return lookup.get(candidate.toLowerCase());
      }
    }
    return null;
  }

  private rowLookup(row: TableRow) {
    return new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value] as const));
  }

  private pickNullableNumber(row: TableRow, candidates: string[]) {
    for (const candidate of candidates) {
      const value = this.pickRowValue(row, [candidate]);
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private getTableName(envKey: string, fallback: string) {
    const raw = this.normalizeString(process.env[envKey]) || fallback;
    return this.safeIdentifier(raw);
  }

  private safeIdentifier(value: string) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      throw new BadRequestException(`Identificador SQL invalido: ${value}`);
    }
    return value;
  }

  private localInferenceEnabled() {
    return String(process.env.AI_LOCAL_INFERENCE_ENABLED ?? "true")
      .trim()
      .toLowerCase() !== "false";
  }

  private usesTelemetryTable() {
    return String(process.env.READINGS_SOURCE || "prisma")
      .trim()
      .toLowerCase() === "telemetry_table";
  }

  private getTelemetryTableName() {
    return this.safeIdentifier(String(process.env.TELEMETRY_TABLE_NAME || "telemetry").trim() || "telemetry");
  }

  private telemetryWindowLimit() {
    return Math.max(5, Math.min(this.readEnvNumber("AI_TELEMETRY_WINDOW", 60), 500));
  }

  private readEnvNumber(name: string, fallback: number) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private toNullableNumber(value: unknown) {
    if (value === null || value === undefined || value === "") return null;
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

  private numbers(
    points: AiTelemetryPoint[],
    selector: (point: AiTelemetryPoint) => number | null,
    limit = points.length,
  ) {
    return points
      .slice(0, limit)
      .map(selector)
      .filter((value): value is number => value !== null && Number.isFinite(value));
  }

  private effectivePowerW(point: AiTelemetryPoint) {
    if (point.loadPowerW !== null && point.loadPowerW >= 0) {
      return point.loadPowerW;
    }
    if (point.outputVoltageAcV !== null && point.outputCurrentAcA !== null) {
      return Math.max(0, point.outputVoltageAcV * point.outputCurrentAcA);
    }
    if (point.powerW !== null) {
      return Math.abs(point.powerW);
    }
    return null;
  }

  private average(values: number[]) {
    if (!values.length) return null;
    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  private median(values: number[]) {
    if (!values.length) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private maxNumber(values: number[]) {
    return values.length ? Math.max(...values) : null;
  }

  private stdDev(values: number[]) {
    if (values.length < 2) return 0;
    const mean = this.average(values) ?? 0;
    const variance = values.reduce((total, value) => total + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private slopePerMinute(
    points: AiTelemetryPoint[],
    selector: (point: AiTelemetryPoint) => number | null,
    limit = points.length,
  ) {
    const samples = points
      .slice(0, limit)
      .map((point) => ({
        timestamp: point.timestamp,
        value: selector(point),
      }))
      .filter((sample): sample is { timestamp: string; value: number } => {
        if (!sample.timestamp || sample.value === null || !Number.isFinite(sample.value)) return false;
        const parsed = new Date(sample.timestamp);
        return !Number.isNaN(parsed.getTime());
      });

    if (samples.length < 2) return 0;
    const newest = samples[0];
    const oldest = samples[samples.length - 1];
    const minutes = (new Date(newest.timestamp).getTime() - new Date(oldest.timestamp).getTime()) / 60000;
    if (!Number.isFinite(minutes) || minutes <= 0) return 0;
    return (newest.value - oldest.value) / minutes;
  }

  private nominalConfidence(points: AiTelemetryPoint[]) {
    const sampleQuality = this.clamp(points.length / Math.min(this.telemetryWindowLimit(), 20), 0, 1);
    const latest = points[0];
    const metricQuality = [
      latest.windSpeedMs,
      this.effectivePowerW(latest),
      latest.batteryPct,
      latest.genTempC,
      latest.vibrationRms,
      latest.rotorRpm,
    ].filter((value) => value !== null && Number.isFinite(value)).length / 6;

    return Number(this.clamp(70 + sampleQuality * 10 + metricQuality * 8, 72, 90).toFixed(1));
  }

  private circularMeanDeg(values: number[]) {
    if (!values.length) return null;
    const sums = values.reduce(
      (accumulator, value) => {
        const radians = (value * Math.PI) / 180;
        return {
          sin: accumulator.sin + Math.sin(radians),
          cos: accumulator.cos + Math.cos(radians),
        };
      },
      { sin: 0, cos: 0 },
    );
    if (Math.abs(sums.sin) < 0.000001 && Math.abs(sums.cos) < 0.000001) {
      return null;
    }
    const degrees = (Math.atan2(sums.sin, sums.cos) * 180) / Math.PI;
    return this.normalizeAngle(degrees);
  }

  private circularSpreadDeg(values: number[], meanDeg: number) {
    if (!values.length) return 180;
    const distances = values.map((value) => this.circularDistanceDeg(value, meanDeg));
    return this.average(distances) ?? 180;
  }

  private circularDistanceDeg(left: number, right: number) {
    const diff = Math.abs(this.normalizeAngle(left)! - this.normalizeAngle(right)!) % 360;
    return diff > 180 ? 360 - diff : diff;
  }

  private clamp(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  private dot(left: number[], right: number[]) {
    return left.reduce((sum, value, index) => sum + value * (right[index] || 0), 0);
  }

  private softmax(scores: number[]) {
    const maxScore = Math.max(...scores);
    const exps = scores.map((score) => Math.exp(score - maxScore));
    const total = exps.reduce((sum, value) => sum + value, 0) || 1;
    return exps.map((value) => value / total);
  }

  private normalizeString(value: unknown) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private normalizeTimestamp(value: unknown) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "number" && Number.isFinite(value)) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed || trimmed.startsWith("0000-00-00")) return null;
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
    }
    return null;
  }

  private normalizePercent(value: number | null) {
    if (value === null) return null;
    const normalized = value <= 1 ? value * 100 : value;
    return Number(Math.max(0, Math.min(100, normalized)).toFixed(1));
  }

  private normalizeAngle(value: number | null) {
    if (value === null) return null;
    const normalized = ((value % 360) + 360) % 360;
    return Number(normalized.toFixed(1));
  }

  private scaleKwToW(value: number | null) {
    if (value === null) return null;
    return Number((value * 1000).toFixed(1));
  }

  private normalizeSeverity(raw: unknown, label: string | null, confidencePct: number | null) {
    const value = String(raw || "")
      .trim()
      .toLowerCase();

    if (["critical", "critico", "critica", "high", "alta", "alto"].includes(value)) {
      return "critical" as const;
    }
    if (["warning", "warn", "media", "medio", "moderate"].includes(value)) {
      return "warning" as const;
    }
    if (["info", "low", "baja", "bajo", "normal"].includes(value)) {
      return "info" as const;
    }

    const normalizedLabel = String(label || "").toLowerCase();
    if (normalizedLabel.includes("fault") || normalizedLabel.includes("critical")) {
      return "critical" as const;
    }
    if (normalizedLabel.includes("temp") || normalizedLabel.includes("vibration") || normalizedLabel.includes("overload")) {
      return "warning" as const;
    }
    if ((confidencePct ?? 0) >= 85) {
      return "warning" as const;
    }
    return "info" as const;
  }

  private pickLatestTimestamp(...timestamps: Array<string | null | undefined>) {
    const valid = timestamps
      .map((value) => (value ? new Date(value) : null))
      .filter((value): value is Date => Boolean(value) && !Number.isNaN(value.getTime()))
      .sort((left, right) => right.getTime() - left.getTime());

    return valid[0]?.toISOString() || null;
  }
}
