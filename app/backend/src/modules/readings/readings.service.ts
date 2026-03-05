import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { IngestReadingDto } from "./dto.ingest";
import { mockLatestReading, mockReadings } from "../../mock/data";
import { AlertsService } from "../alerts/alerts.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";

type SourceNow = "WIND" | "BATTERY" | "BOTH";

@Injectable()
export class ReadingsService {
  constructor(
    private prisma: PrismaService,
    private alerts: AlertsService,
    private realtime: RealtimeGateway,
  ) {}

  list(farmId?: string, plotId?: string) {
    if (process.env.MOCK_DATA === "true") {
      return mockReadings(24);
    }
    return this.prisma.sensorReading.findMany({
      where: {
        ...(farmId ? { farmId } : {}),
        ...(plotId ? { plotId } : {}),
      },
      orderBy: { timestamp: "desc" },
      take: 200,
    });
  }

  async latest(deviceId: string) {
    if (process.env.MOCK_DATA === "true") {
      return mockLatestReading();
    }
    if (!deviceId) {
      throw new BadRequestException("deviceId es requerido.");
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

    const deviceId = dto.deviceId.trim();
    if (!deviceId) {
      throw new BadRequestException("deviceId es requerido.");
    }
    const timestampRaw = dto.ts || dto.timestamp || new Date().toISOString();
    const timestamp = new Date(timestampRaw);
    if (Number.isNaN(timestamp.getTime())) {
      throw new BadRequestException("Fecha inválida en ts/timestamp.");
    }

    const defaultLoadW = this.fromEnvNumber("DEFAULT_LOAD_W", 300);
    const loadPowerW = this.toFixed2(Math.max(1, dto.loadPowerW ?? defaultLoadW));
    const powerW = this.toFixed2(dto.genVoltageV * dto.genCurrentA);
    const { sourceNow, sourceReason } = this.resolveSource(powerW, loadPowerW);

    const existingDevice = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { farmId: true, plotId: true },
    });

    const farmId = dto.farmId || existingDevice?.farmId || "demo-farm";
    const plotId = dto.plotId || existingDevice?.plotId || "demo-plot";

    // Ensure system user/farm/plot/device exist
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
      where: { id: deviceId },
      update: { farmId, plotId },
      create: { id: deviceId, name: "Edge Device", farmId, plotId, status: "active" as any },
    });

    const previous = await this.prisma.sensorReading.findFirst({
      where: { deviceId },
      orderBy: { timestamp: "desc" },
      select: { timestamp: true, energyTodayKwh: true },
    });

    const energyTodayKwh = this.computeEnergyTodayKwh({
      previousTimestamp: previous?.timestamp || null,
      previousEnergyTodayKwh: previous?.energyTodayKwh || null,
      currentTimestamp: timestamp,
      powerW,
    });

    const reading = await this.prisma.sensorReading.create({
      data: {
        deviceId,
        farmId,
        plotId,
        timestamp,
        humidity: 0,
        temperature: 0,
        ph: 7,
        n: 0,
        p: 0,
        k: 0,
        windSpeed: dto.windSpeedMs,
        genVoltageV: dto.genVoltageV,
        genCurrentA: dto.genCurrentA,
        powerW,
        loadPowerW,
        sourceNow: sourceNow as any,
        sourceReason,
        vibrationRms: dto.vibrationRms,
        genTempC: dto.genTempC,
        batteryPct: dto.batteryPct,
        energyTodayKwh,
        ingestMode: dto.mode || "manual",
        season: "aerogenerator",
      },
    });

    const readingView = this.toAerogeneratorView(reading);
    this.realtime.emitReading(readingView);

    const alerts = await this.alerts.generateFromAerogeneratorReading({
      deviceId,
      farmId,
      plotId,
      windSpeedMs: dto.windSpeedMs,
      genTempC: dto.genTempC,
      vibrationRms: dto.vibrationRms,
      batteryPct: dto.batteryPct,
    });

    return {
      status: "accepted",
      readingId: reading.id,
      powerW,
      energyTodayKwh,
      sourceNow,
      sourceReason,
      alertsCreated: alerts.length,
    };
  }

  private computeEnergyTodayKwh(input: {
    previousTimestamp: Date | null;
    previousEnergyTodayKwh: number | null;
    currentTimestamp: Date;
    powerW: number;
  }) {
    const now = input.currentTimestamp;
    const previous = input.previousTimestamp;
    const sameUtcDay =
      previous &&
      previous.getUTCFullYear() === now.getUTCFullYear() &&
      previous.getUTCMonth() === now.getUTCMonth() &&
      previous.getUTCDate() === now.getUTCDate();

    const intervalSeconds = sameUtcDay
      ? Math.max(1, (now.getTime() - previous.getTime()) / 1000)
      : this.fromEnvNumber("SIM_INTERVAL_SECONDS", 5);

    const incrementalKwh = (input.powerW / 1000) * (intervalSeconds / 3600);
    const previousKwh = sameUtcDay ? Number(input.previousEnergyTodayKwh || 0) : 0;
    return this.toFixed6(previousKwh + incrementalKwh);
  }

  private resolveSource(powerW: number, loadPowerW: number): {
    sourceNow: SourceNow;
    sourceReason: string;
  } {
    if (powerW <= 0) {
      return {
        sourceNow: "BATTERY",
        sourceReason: "No hay viento suficiente; se usa energía almacenada en batería.",
      };
    }

    if (powerW >= loadPowerW) {
      return {
        sourceNow: "WIND",
        sourceReason: "El viento genera suficiente energía para cubrir la demanda actual.",
      };
    }

    return {
      sourceNow: "BOTH",
      sourceReason: "El viento genera energía, pero no alcanza para cubrir toda la demanda actual.",
    };
  }

  private toAerogeneratorView(reading: any) {
    return {
      id: reading.id,
      deviceId: reading.deviceId,
      farmId: reading.farmId,
      plotId: reading.plotId,
      ts: reading.timestamp,
      windSpeedMs: reading.windSpeed ?? null,
      genVoltageV: reading.genVoltageV ?? null,
      genCurrentA: reading.genCurrentA ?? null,
      powerW: reading.powerW ?? null,
      loadPowerW: reading.loadPowerW ?? null,
      sourceNow: reading.sourceNow ?? null,
      sourceReason: reading.sourceReason ?? null,
      vibrationRms: reading.vibrationRms ?? null,
      genTempC: reading.genTempC ?? null,
      batteryPct: reading.batteryPct ?? null,
      energyTodayKwh: reading.energyTodayKwh ?? null,
      mode: reading.ingestMode ?? null,
      createdAt: reading.createdAt,
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

