import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { IngestReadingDto } from "./dto.ingest";
import { mockLatestReading, mockReadings } from "../../mock/data";
import { AlertsService } from "../alerts/alerts.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { TelemetryTableService } from "./telemetry-table.service";

type SourceNow = "WIND" | "BATTERY" | "BOTH";

type NormalizedReadingInput = {
  deviceId: string;
  farmId?: string;
  plotId?: string;
  timestamp: Date;
  windSpeedMs: number | null;
  windDirectionDeg: number | null;
  batteryVoltageDcV: number | null;
  batteryCurrentDcA: number | null;
  batteryPowerW: number | null;
  batterySocPct: number | null;
  batteryAutonomyEstimatedH: number | null;
  housePowerConsumptionW: number | null;
  inverterOutputVoltageAcV: number | null;
  inverterOutputCurrentAcA: number | null;
  inverterTempC: number | null;
  motorVibration: number | null;
  vibrationSignal: number | null;
  bladeRpm: number | null;
  energyDeliveredWh: number | null;
  batteryAlertLow: boolean | null;
  batteryAlertOverload: boolean | null;
  batteryAlertOvertemp: boolean | null;
  inverterAlertOverload: boolean | null;
  inverterAlertFault: boolean | null;
  inverterAlertSupplyCut: boolean | null;
  ingestMode: string | null;
};

type GenericObject = Record<string, unknown>;

@Injectable()
export class ReadingsService {
  constructor(
    private prisma: PrismaService,
    private alerts: AlertsService,
    private realtime: RealtimeGateway,
    private telemetryTable: TelemetryTableService,
  ) {}

  async list(deviceId?: string, farmId?: string, plotId?: string) {
    if (process.env.MOCK_DATA === "true") {
      return mockReadings(24);
    }

    if (this.telemetryTable.isEnabled()) {
      return this.telemetryTable.list({ deviceId, farmId, plotId, take: 200 });
    }

    const readings = await this.prisma.sensorReading.findMany({
      where: {
        ...(deviceId ? { deviceId } : {}),
        ...(farmId ? { farmId } : {}),
        ...(plotId ? { plotId } : {}),
      },
      orderBy: { timestamp: "desc" },
      take: 200,
    });

    return readings.map((reading) => this.toAerogeneratorView(reading));
  }

  async latest(deviceId: string) {
    if (process.env.MOCK_DATA === "true") {
      return mockLatestReading();
    }
    if (!deviceId) {
      throw new BadRequestException("deviceId es requerido.");
    }

    if (this.telemetryTable.isEnabled()) {
      return this.telemetryTable.latest(deviceId);
    }

    const reading = await this.prisma.sensorReading.findFirst({
      where: { deviceId },
      orderBy: { timestamp: "desc" },
    });

    return reading ? this.toAerogeneratorView(reading) : null;
  }

  async ingest(dto: IngestReadingDto) {
    if (process.env.MOCK_DATA === "true") {
      return { status: "accepted", payload: dto };
    }

    const metrics = this.normalizeInput(dto);
    this.assertRequiredTelemetry(metrics);

    const existingDevice = await this.prisma.device.findUnique({
      where: { id: metrics.deviceId },
      select: { farmId: true, plotId: true },
    });

    const farmId = metrics.farmId || existingDevice?.farmId || "demo-farm";
    const plotId = metrics.plotId || existingDevice?.plotId || "demo-plot";

    const systemUser = await this.prisma.user.upsert({
      where: { email: "system@AeroGenIoT.local" },
      update: {},
      create: {
        email: "system@AeroGenIoT.local",
        passwordHash: "system",
        name: "System",
      },
    });

    await this.prisma.farm.upsert({
      where: { id: farmId },
      update: {},
      create: { id: farmId, ownerId: systemUser.id, name: "Demo Farm" },
    });

    await this.prisma.plot.upsert({
      where: { id: plotId },
      update: {},
      create: { id: plotId, farmId, name: "Demo Plot" },
    });

    await this.prisma.device.upsert({
      where: { id: metrics.deviceId },
      update: { farmId, plotId },
      create: { id: metrics.deviceId, name: "Edge Device", farmId, plotId, status: "active" as any },
    });

    const previous = await this.prisma.sensorReading.findFirst({
      where: { deviceId: metrics.deviceId },
      orderBy: { timestamp: "desc" },
      select: {
        timestamp: true,
        energyTodayKwh: true,
        energyDeliveredWh: true,
      },
    });

    const deliveredPowerW = this.deliveredPowerFromInput(metrics);
    const energyDeliveredWh =
      metrics.energyDeliveredWh ??
      this.computeEnergyDeliveredWh({
        previousTimestamp: previous?.timestamp || null,
        previousEnergyDeliveredWh: previous?.energyDeliveredWh || null,
        currentTimestamp: metrics.timestamp,
        deliveredPowerW,
      });

    const energyTodayKwh = await this.computeEnergyTodayKwh({
      deviceId: metrics.deviceId,
      currentTimestamp: metrics.timestamp,
      currentEnergyDeliveredWh: energyDeliveredWh,
      deliveredPowerW,
      previousTimestamp: previous?.timestamp || null,
      previousEnergyTodayKwh: previous?.energyTodayKwh || null,
    });

    const batteryPowerW =
      metrics.batteryPowerW ??
      this.toFixed2((metrics.batteryVoltageDcV || 0) * (metrics.batteryCurrentDcA || 0));

    const batteryAutonomyEstimatedH =
      metrics.batteryAutonomyEstimatedH ??
      this.estimateAutonomyHours(metrics.batterySocPct, metrics.housePowerConsumptionW);

    const { sourceNow, sourceReason } = this.resolveSource({
      windSpeedMs: metrics.windSpeedMs,
      batteryPowerW,
      housePowerConsumptionW: metrics.housePowerConsumptionW,
    });

    const reading = await this.prisma.sensorReading.create({
      data: {
        deviceId: metrics.deviceId,
        farmId,
        plotId,
        timestamp: metrics.timestamp,
        humidity: 0,
        temperature: 0,
        ph: 7,
        n: 0,
        p: 0,
        k: 0,
        windSpeed: metrics.windSpeedMs,
        windDirectionDeg: metrics.windDirectionDeg,
        genVoltageV: metrics.batteryVoltageDcV,
        genCurrentA: metrics.batteryCurrentDcA,
        powerW: batteryPowerW,
        loadPowerW: metrics.housePowerConsumptionW,
        sourceNow: sourceNow as any,
        sourceReason,
        vibrationRms: metrics.motorVibration,
        vibrationSignal: metrics.vibrationSignal,
        genTempC: metrics.inverterTempC,
        batteryPct: metrics.batterySocPct,
        batteryAutonomyEstimatedH,
        outputVoltageAcV: metrics.inverterOutputVoltageAcV,
        outputCurrentAcA: metrics.inverterOutputCurrentAcA,
        rotorRpm: metrics.bladeRpm,
        energyDeliveredWh,
        energyTodayKwh,
        batteryAlertLow: metrics.batteryAlertLow,
        batteryAlertOverload: metrics.batteryAlertOverload,
        batteryAlertOvertemp: metrics.batteryAlertOvertemp,
        inverterAlertOverload: metrics.inverterAlertOverload,
        inverterAlertFault: metrics.inverterAlertFault,
        inverterAlertSupplyCut: metrics.inverterAlertSupplyCut,
        ingestMode: metrics.ingestMode || "cloud",
        season: "aerogenerator",
      },
    });

    const readingView = this.toAerogeneratorView(reading);
    this.realtime.emitReading(readingView);

    const alerts = await this.alerts.generateFromAerogeneratorReading({
      deviceId: metrics.deviceId,
      farmId,
      plotId,
      batterySocPct: metrics.batterySocPct || 0,
      batteryVoltageDcV: metrics.batteryVoltageDcV || 0,
      batteryCurrentDcA: metrics.batteryCurrentDcA || 0,
      inverterOutputVoltageAcV: metrics.inverterOutputVoltageAcV || 0,
      inverterOutputCurrentAcA: metrics.inverterOutputCurrentAcA || 0,
      housePowerConsumptionW: metrics.housePowerConsumptionW || 0,
      inverterTempC: metrics.inverterTempC || 0,
      windSpeedMs: metrics.windSpeedMs || 0,
      motorVibration: metrics.motorVibration || 0,
      bladeRpm: metrics.bladeRpm || 0,
      batteryAlertLow: metrics.batteryAlertLow,
      batteryAlertOverload: metrics.batteryAlertOverload,
      batteryAlertOvertemp: metrics.batteryAlertOvertemp,
      inverterAlertOverload: metrics.inverterAlertOverload,
      inverterAlertFault: metrics.inverterAlertFault,
      inverterAlertSupplyCut: metrics.inverterAlertSupplyCut,
    });

    return {
      status: "accepted",
      readingId: reading.id,
      batteryPowerW,
      batteryAutonomyEstimatedH,
      energyDeliveredWh,
      energyTodayKwh,
      sourceNow,
      alertsCreated: alerts.length,
    };
  }

  async ingestIotdaPropertyPush(payload: unknown) {
    const dto = this.mapIotdaPropertyPushToIngestDto(payload);
    return this.ingest(dto);
  }

  private normalizeInput(dto: IngestReadingDto): NormalizedReadingInput {
    const deviceId = String(dto.deviceId || "").trim();
    if (!deviceId) {
      throw new BadRequestException("deviceId es requerido.");
    }

    const timestampRaw = dto.ts || dto.timestamp || new Date().toISOString();
    const timestamp = new Date(timestampRaw);
    if (Number.isNaN(timestamp.getTime())) {
      throw new BadRequestException("Fecha invalida en ts/timestamp.");
    }

    return {
      deviceId,
      farmId: dto.farmId?.trim() || undefined,
      plotId: dto.plotId?.trim() || undefined,
      timestamp,
      windSpeedMs: this.firstFinite(dto.wind_speed_mps, dto.windSpeedMs),
      windDirectionDeg: this.normalizeDirection(this.firstFinite(dto.wind_dir_deg, dto.windDirectionDeg)),
      batteryVoltageDcV: this.firstFinite(dto.battery_voltage_dc_v, dto.batteryVoltageDcV, dto.genVoltageV),
      batteryCurrentDcA: this.firstFinite(dto.battery_current_dc_a, dto.batteryCurrentDcA, dto.genCurrentA),
      batteryPowerW: this.firstFinite(dto.battery_power_w, dto.batteryPowerW),
      batterySocPct: this.firstFinite(dto.battery_soc_pct, dto.stateOfChargePct, dto.batterySocPct, dto.batteryPct),
      batteryAutonomyEstimatedH: this.firstFinite(dto.battery_autonomy_estimated_h, dto.batteryAutonomyEstimatedH),
      housePowerConsumptionW: this.firstFinite(dto.house_power_consumption_w, dto.loadPowerW),
      inverterOutputVoltageAcV: this.firstFinite(dto.inverter_output_voltage_ac_v, dto.outputVoltageAcV),
      inverterOutputCurrentAcA: this.firstFinite(dto.inverter_output_current_ac_a, dto.outputCurrentAcA),
      inverterTempC: this.firstFinite(dto.inverter_temp_c, dto.genTempC),
      motorVibration: this.firstFinite(dto.motor_vibration, dto.vibrationRms),
      vibrationSignal: this.firstFinite(dto.vibration_signal, dto.vibrationSignal),
      bladeRpm: this.firstFinite(dto.blade_rpm, dto.rotorRpm),
      energyDeliveredWh: this.firstFinite(dto.energy_delivered_wh, dto.energyDeliveredWh),
      batteryAlertLow: this.toNullableBoolean(dto.battery_alert_low),
      batteryAlertOverload: this.toNullableBoolean(dto.battery_alert_overload),
      batteryAlertOvertemp: this.toNullableBoolean(dto.battery_alert_overtemp),
      inverterAlertOverload: this.toNullableBoolean(dto.inverter_alert_overload),
      inverterAlertFault: this.toNullableBoolean(dto.inverter_alert_fault),
      inverterAlertSupplyCut: this.toNullableBoolean(dto.inverter_alert_supply_cut),
      ingestMode: dto.mode?.trim() || null,
    };
  }

  private mapIotdaPropertyPushToIngestDto(payload: unknown): IngestReadingDto {
    const root = this.asRecord(payload);
    if (!root) {
      throw new BadRequestException("Payload de IoTDA invalido.");
    }

    if (Array.isArray(root.services)) {
      return this.mapPropertyReportBodyToIngestDto(root, root);
    }

    const notifyData = this.asRecord(root.notify_data);
    const header = this.asRecord(notifyData?.header);
    const body = this.asRecord(notifyData?.body);

    if (!body || !Array.isArray(body.services)) {
      throw new BadRequestException("Payload de IoTDA sin notify_data.body.services.");
    }

    return this.mapPropertyReportBodyToIngestDto(body, {
      device_id: header?.device_id,
      deviceId: header?.device_id,
      event_time_ms: root.event_time_ms,
      event_time: root.event_time,
      ts: root.ts,
      timestamp: root.timestamp,
      mode: "iotda-http-push",
    });
  }

  private mapPropertyReportBodyToIngestDto(body: GenericObject, envelope: GenericObject): IngestReadingDto {
    const services = Array.isArray(body.services) ? body.services : [];
    const mergedProperties = services.reduce<GenericObject>((accumulator, service) => {
      const serviceRecord = this.asRecord(service);
      const properties = this.asRecord(serviceRecord?.properties);
      if (!properties) return accumulator;
      return { ...accumulator, ...properties };
    }, {});

    const firstService = this.asRecord(services[0]);
    const eventTime = this.normalizeIotdaTimestamp(
      this.firstString(
        envelope.event_time_ms,
        envelope.event_time,
        firstService?.event_time,
        mergedProperties.ts,
        mergedProperties.timestamp,
      ),
    );

    const deviceId = this.firstString(
      envelope.deviceId,
      envelope.device_id,
      mergedProperties.deviceId,
      mergedProperties.device_id,
    );

    if (!deviceId) {
      throw new BadRequestException("Payload de IoTDA sin device_id.");
    }

    return {
      ...((mergedProperties as unknown) as Partial<IngestReadingDto>),
      deviceId,
      ts: eventTime,
      timestamp: eventTime,
      mode: this.firstString(mergedProperties.mode, envelope.mode) || "iotda-http-push",
    };
  }

  private assertRequiredTelemetry(metrics: NormalizedReadingInput) {
    const required: Array<[keyof NormalizedReadingInput, string]> = [
      ["windSpeedMs", "wind_speed_mps"],
      ["windDirectionDeg", "wind_dir_deg"],
      ["batteryVoltageDcV", "battery_voltage_dc_v"],
      ["batteryCurrentDcA", "battery_current_dc_a"],
      ["batterySocPct", "battery_soc_pct"],
      ["inverterOutputVoltageAcV", "inverter_output_voltage_ac_v"],
      ["inverterOutputCurrentAcA", "inverter_output_current_ac_a"],
      ["housePowerConsumptionW", "house_power_consumption_w"],
      ["inverterTempC", "inverter_temp_c"],
      ["motorVibration", "motor_vibration"],
      ["bladeRpm", "blade_rpm"],
    ];

    const missing = required
      .filter(([key]) => metrics[key] === null || metrics[key] === undefined)
      .map(([, label]) => label);

    if (missing.length) {
      throw new BadRequestException(`Faltan variables requeridas: ${missing.join(", ")}.`);
    }
  }

  private deliveredPowerFromInput(metrics: NormalizedReadingInput) {
    if (metrics.inverterAlertSupplyCut) return 0;
    if (metrics.housePowerConsumptionW !== null) return metrics.housePowerConsumptionW;
    if (metrics.inverterOutputVoltageAcV !== null && metrics.inverterOutputCurrentAcA !== null) {
      return this.toFixed2(metrics.inverterOutputVoltageAcV * metrics.inverterOutputCurrentAcA);
    }
    return 0;
  }

  private computeEnergyDeliveredWh(input: {
    previousTimestamp: Date | null;
    previousEnergyDeliveredWh: number | null;
    currentTimestamp: Date;
    deliveredPowerW: number;
  }) {
    const previousWh = Number(input.previousEnergyDeliveredWh || 0);
    const intervalSeconds = input.previousTimestamp
      ? Math.max(1, (input.currentTimestamp.getTime() - input.previousTimestamp.getTime()) / 1000)
      : this.fromEnvNumber("SIM_INTERVAL_SECONDS", 10);

    const incrementalWh = (input.deliveredPowerW * intervalSeconds) / 3600;
    return this.toFixed2(previousWh + Math.max(0, incrementalWh));
  }

  private async computeEnergyTodayKwh(input: {
    deviceId: string;
    currentTimestamp: Date;
    currentEnergyDeliveredWh: number;
    deliveredPowerW: number;
    previousTimestamp: Date | null;
    previousEnergyTodayKwh: number | null;
  }) {
    const dayStart = new Date(Date.UTC(
      input.currentTimestamp.getUTCFullYear(),
      input.currentTimestamp.getUTCMonth(),
      input.currentTimestamp.getUTCDate(),
      0,
      0,
      0,
      0,
    ));

    const firstReadingOfDay = await this.prisma.sensorReading.findFirst({
      where: {
        deviceId: input.deviceId,
        timestamp: {
          gte: dayStart,
          lte: input.currentTimestamp,
        },
      },
      orderBy: { timestamp: "asc" },
      select: {
        energyDeliveredWh: true,
      },
    });

    if (firstReadingOfDay?.energyDeliveredWh !== null && firstReadingOfDay?.energyDeliveredWh !== undefined) {
      return this.toFixed6(Math.max(0, input.currentEnergyDeliveredWh - Number(firstReadingOfDay.energyDeliveredWh)) / 1000);
    }

    const sameUtcDay =
      input.previousTimestamp &&
      input.previousTimestamp.getUTCFullYear() === input.currentTimestamp.getUTCFullYear() &&
      input.previousTimestamp.getUTCMonth() === input.currentTimestamp.getUTCMonth() &&
      input.previousTimestamp.getUTCDate() === input.currentTimestamp.getUTCDate();

    const intervalSeconds = sameUtcDay && input.previousTimestamp
      ? Math.max(1, (input.currentTimestamp.getTime() - input.previousTimestamp.getTime()) / 1000)
      : this.fromEnvNumber("SIM_INTERVAL_SECONDS", 10);

    const incrementalKwh = (input.deliveredPowerW / 1000) * (intervalSeconds / 3600);
    const previousKwh = sameUtcDay ? Number(input.previousEnergyTodayKwh || 0) : 0;
    return this.toFixed6(previousKwh + Math.max(0, incrementalKwh));
  }

  private estimateAutonomyHours(batterySocPct: number | null, housePowerConsumptionW: number | null) {
    if (batterySocPct === null || housePowerConsumptionW === null || housePowerConsumptionW <= 0) return null;
    const capacityKwh = this.fromEnvNumber("BATTERY_CAPACITY_KWH", 4.8);
    const availableKwh = capacityKwh * (batterySocPct / 100);
    return this.toFixed2(availableKwh / (housePowerConsumptionW / 1000));
  }

  private resolveSource(input: {
    windSpeedMs: number | null;
    batteryPowerW: number | null;
    housePowerConsumptionW: number | null;
  }): {
    sourceNow: SourceNow;
    sourceReason: string;
  } {
    if ((input.batteryPowerW ?? 0) > 60 || (input.windSpeedMs ?? 0) < 3) {
      return {
        sourceNow: "BATTERY",
        sourceReason: "La bateria esta sosteniendo la vivienda por baja disponibilidad eolica.",
      };
    }

    if ((input.batteryPowerW ?? 0) < -60) {
      return {
        sourceNow: "WIND",
        sourceReason: "El viento cubre la demanda y permite cargar la bateria.",
      };
    }

    return {
      sourceNow: "BOTH",
      sourceReason: "El viento y la bateria comparten el suministro actual.",
    };
  }

  private toAerogeneratorView(reading: any) {
    const ts = reading.timestamp instanceof Date ? reading.timestamp.toISOString() : reading.timestamp;

    return {
      id: reading.id,
      deviceId: reading.deviceId,
      farmId: reading.farmId,
      plotId: reading.plotId,
      ts,
      timestamp: ts,
      createdAt: reading.createdAt,
      wind_speed_mps: reading.windSpeed ?? null,
      wind_dir_deg: reading.windDirectionDeg ?? null,
      battery_voltage_dc_v: reading.genVoltageV ?? null,
      battery_current_dc_a: reading.genCurrentA ?? null,
      battery_power_w: reading.powerW ?? null,
      battery_soc_pct: reading.batteryPct ?? null,
      battery_autonomy_estimated_h: reading.batteryAutonomyEstimatedH ?? null,
      inverter_output_voltage_ac_v: reading.outputVoltageAcV ?? null,
      inverter_output_current_ac_a: reading.outputCurrentAcA ?? null,
      house_power_consumption_w: reading.loadPowerW ?? null,
      energy_delivered_wh: reading.energyDeliveredWh ?? null,
      inverter_temp_c: reading.genTempC ?? null,
      motor_vibration: reading.vibrationRms ?? null,
      blade_rpm: reading.rotorRpm ?? null,
      vibration_signal: reading.vibrationSignal ?? null,
      battery_alert_low: reading.batteryAlertLow ?? null,
      battery_alert_overload: reading.batteryAlertOverload ?? null,
      battery_alert_overtemp: reading.batteryAlertOvertemp ?? null,
      inverter_alert_overload: reading.inverterAlertOverload ?? null,
      inverter_alert_fault: reading.inverterAlertFault ?? null,
      inverter_alert_supply_cut: reading.inverterAlertSupplyCut ?? null,
      windSpeedMs: reading.windSpeed ?? null,
      windDirectionDeg: reading.windDirectionDeg ?? null,
      genVoltageV: reading.genVoltageV ?? null,
      genCurrentA: reading.genCurrentA ?? null,
      powerW: reading.powerW ?? null,
      loadPowerW: reading.loadPowerW ?? null,
      outputVoltageAcV: reading.outputVoltageAcV ?? null,
      outputCurrentAcA: reading.outputCurrentAcA ?? null,
      vibrationRms: reading.vibrationRms ?? null,
      vibrationSignal: reading.vibrationSignal ?? null,
      genTempC: reading.genTempC ?? null,
      rotorRpm: reading.rotorRpm ?? null,
      batteryPct: reading.batteryPct ?? null,
      estimatedAutonomyHours: reading.batteryAutonomyEstimatedH ?? null,
      energyTodayKwh: reading.energyTodayKwh ?? null,
      sourceNow: reading.sourceNow ?? null,
      sourceReason: reading.sourceReason ?? null,
      mode: reading.ingestMode ?? null,
    };
  }

  private firstFinite(...values: unknown[]) {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  private normalizeDirection(value: number | null) {
    if (value === null) return null;
    return ((value % 360) + 360) % 360;
  }

  private normalizeIotdaTimestamp(value: string | null) {
    if (!value) return new Date().toISOString();
    if (/^\d{8}T\d{6}Z$/.test(value)) {
      const year = value.slice(0, 4);
      const month = value.slice(4, 6);
      const day = value.slice(6, 8);
      const hour = value.slice(9, 11);
      const minute = value.slice(11, 13);
      const second = value.slice(13, 15);
      return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  private asRecord(value: unknown): GenericObject | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as GenericObject) : null;
  }

  private firstString(...values: unknown[]) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  }

  private toNullableBoolean(value: unknown) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "si"].includes(normalized)) return true;
      if (["false", "0", "no"].includes(normalized)) return false;
    }
    return null;
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
