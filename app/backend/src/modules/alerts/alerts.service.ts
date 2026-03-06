import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { mockAlerts } from "../../mock/data";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";

type ThresholdSet = {
  humidityMin: number;
  humidityMax: number;
  temperatureMin: number;
  temperatureMax: number;
  phMin: number;
  phMax: number;
  ceMin: number;
  ceMax: number;
  nMin: number;
  nMax: number;
  pMin: number;
  pMax: number;
  kMin: number;
  kMax: number;
};

type MetricAudit = {
  outsideNow: boolean;
  crossedRange: boolean;
  abruptChange: boolean;
  direction: "low" | "high" | null;
  current: number;
  previous: number | null;
  min: number;
  max: number;
};

type AlertCandidate = {
  type: "humidity" | "temperature" | "ph" | "ce" | "npk";
  message: string;
  audit: Record<string, unknown>;
};

type AerogeneratorAlertInput = {
  deviceId: string;
  farmId: string;
  plotId?: string | null;
  windSpeedMs: number;
  genTempC: number;
  vibrationRms: number;
  batteryPct: number;
};

const AEROGEN_MESSAGES = {
  windDanger: "Viento peligroso detectado: se detuvo por seguridad.",
  tempHigh: "Temperatura alta detectada: se detuvo temporalmente para enfriarse.",
  vibrationHigh: "Vibracion alta detectada: se recomienda revisar posteriormente aspas/soportes.",
  batteryLow: "Bateria baja detectada: reducir consumo ~10%.",
} as const;

const DEFAULT_THRESHOLDS: ThresholdSet = {
  humidityMin: 25,
  humidityMax: 70,
  temperatureMin: 12,
  temperatureMax: 32,
  phMin: 5.5,
  phMax: 7.5,
  ceMin: 1.0,
  ceMax: 2.5,
  nMin: 40,
  nMax: 120,
  pMin: 30,
  pMax: 90,
  kMin: 80,
  kMax: 130,
};

const CROP_THRESHOLD_OVERRIDES: Record<string, Partial<ThresholdSet>> = {
  tomato: {
    humidityMin: 28,
    humidityMax: 65,
    temperatureMin: 16,
    temperatureMax: 30,
    phMin: 5.8,
    phMax: 6.8,
    ceMin: 1.2,
    ceMax: 2.8,
    nMin: 60,
    nMax: 140,
    pMin: 35,
    pMax: 95,
    kMin: 110,
    kMax: 210,
  },
  potato: {
    humidityMin: 30,
    humidityMax: 72,
    temperatureMin: 12,
    temperatureMax: 24,
    phMin: 5.2,
    phMax: 6.4,
    ceMin: 1.0,
    ceMax: 2.2,
    nMin: 55,
    nMax: 130,
    pMin: 30,
    pMax: 85,
    kMin: 120,
    kMax: 220,
  },
  maize: {
    humidityMin: 24,
    humidityMax: 60,
    temperatureMin: 14,
    temperatureMax: 34,
    phMin: 5.8,
    phMax: 7.2,
    ceMin: 0.8,
    ceMax: 2.3,
    nMin: 70,
    nMax: 160,
    pMin: 25,
    pMax: 70,
    kMin: 90,
    kMax: 170,
  },
  rice: {
    humidityMin: 35,
    humidityMax: 85,
    temperatureMin: 18,
    temperatureMax: 34,
    phMin: 5.0,
    phMax: 6.8,
    ceMin: 0.7,
    ceMax: 2.0,
    nMin: 65,
    nMax: 145,
    pMin: 20,
    pMax: 65,
    kMin: 80,
    kMax: 160,
  },
  wheat: {
    humidityMin: 20,
    humidityMax: 55,
    temperatureMin: 10,
    temperatureMax: 28,
    phMin: 6.0,
    phMax: 7.5,
    ceMin: 0.8,
    ceMax: 2.0,
    nMin: 50,
    nMax: 130,
    pMin: 20,
    pMax: 65,
    kMin: 80,
    kMax: 150,
  },
};

const ABRUPT_CHANGE_DELTA = {
  humidity: 12,
  temperature: 5,
  ph: 0.5,
  ce: 0.7,
  n: 20,
  p: 15,
  k: 25,
};

const normalizeCropKey = (value: string | null | undefined) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

@Injectable()
export class AlertsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private realtime: RealtimeGateway,
  ) {}

  list(farmId?: string, status?: string) {
    if (process.env.MOCK_DATA === "true") {
      return mockAlerts();
    }
    return this.prisma.alert.findMany({
      where: {
        ...(farmId ? { farmId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  recentByDevice(deviceId: string) {
    if (!deviceId) {
      throw new BadRequestException("deviceId es requerido.");
    }

    return this.prisma.alert.findMany({
      where: { deviceId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async generateFromAerogeneratorReading(input: AerogeneratorAlertInput) {
    const thresholds = {
      windDangerMs: this.readEnvNumber("ALERT_WIND_DANGEROUS_MS", 20),
      tempHighC: this.readEnvNumber("ALERT_GEN_TEMP_HIGH_C", 80),
      vibrationHighRms: this.readEnvNumber("ALERT_VIBRATION_HIGH_RMS", 6),
      batteryLowPct: this.readEnvNumber("ALERT_BATTERY_LOW_PCT", 20),
    };

    const candidates: Array<{ type: any; message: string }> = [];

    if (input.windSpeedMs > thresholds.windDangerMs) {
      candidates.push({ type: "wind_danger", message: AEROGEN_MESSAGES.windDanger });
    }

    if (input.genTempC > thresholds.tempHighC) {
      candidates.push({ type: "generator_temp_high", message: AEROGEN_MESSAGES.tempHigh });
    }

    if (input.vibrationRms > thresholds.vibrationHighRms) {
      candidates.push({ type: "vibration_high", message: AEROGEN_MESSAGES.vibrationHigh });
    }

    if (input.batteryPct < thresholds.batteryLowPct) {
      candidates.push({ type: "battery_low", message: AEROGEN_MESSAGES.batteryLow });
    }

    const createdAlerts: any[] = [];

    for (const candidate of candidates) {
      const duplicated = await this.hasOpenDeviceAlertSameReason(
        input.deviceId,
        candidate.type,
        candidate.message,
      );
      if (duplicated) continue;

      const created = await this.prisma.alert.create({
        data: {
          deviceId: input.deviceId,
          farmId: input.farmId,
          plotId: input.plotId ?? null,
          type: candidate.type,
          status: "open",
          message: candidate.message,
        },
      });

      createdAlerts.push(created);
      this.realtime.emitAlert(created);
      await this.notifications.sendAlert(created);
    }

    return createdAlerts;
  }

  async ack(alertId: string) {
    const alert = await this.prisma.alert.update({
      where: { id: alertId },
      data: { status: "acknowledged" },
    });
    this.realtime.emitAlertUpdate(alert);
    return alert;
  }

  async resolve(alertId: string) {
    const alert = await this.prisma.alert.update({
      where: { id: alertId },
      data: { status: "resolved" },
      include: { farm: { select: { ownerId: true } } },
    });
    const summary = `Alerta de riego: ${alert.message}`;
    await this.prisma.report.updateMany({
      where: {
        userId: alert.farm.ownerId,
        ...(alert.plotId ? { parcelId: alert.plotId } : { parcelId: null }),
        summary,
        status: "open",
      },
      data: { status: "closed" },
    });
    this.realtime.emitAlertUpdate(alert);
    return alert;
  }

  async generateFromReading(reading: any) {
    const [farm, plot, thresholdProfile, previous] = await Promise.all([
      this.prisma.farm.findUnique({
        where: { id: reading.farmId },
        select: { ownerId: true },
      }),
      reading.plotId
        ? this.prisma.plot.findUnique({
            where: { id: reading.plotId },
            select: {
              id: true,
              cropId: true,
              cropType: true,
              stageId: true,
              zoneId: true,
              crop: { select: { name: true } },
            },
          })
        : Promise.resolve(null),
      this.resolveThresholdProfile(reading.farmId, reading.plotId ?? null),
      this.fetchPreviousReading(reading),
    ]);

    const cropName = String(plot?.crop?.name || plot?.cropType || "").trim() || null;
    const thresholds = this.resolveThresholds(thresholdProfile, cropName);
    const alertCandidates = this.buildAlertCandidates(reading, previous, thresholds, cropName);

    const createdAlerts: any[] = [];

    for (const candidate of alertCandidates) {
      const duplicated = await this.hasOpenAlertSameReason(
        reading.farmId,
        reading.plotId,
        candidate.type,
        candidate.message,
      );
      if (duplicated) {
        continue;
      }

      const created = await this.prisma.alert.create({
        data: {
          farmId: reading.farmId,
          plotId: reading.plotId,
          type: candidate.type,
          status: "open",
          message: candidate.message,
        },
      });

      createdAlerts.push(created);
      this.realtime.emitAlert(created);
      await this.notifications.sendAlert(created);
      await this.createIrrigationReportIfNeeded({
        ownerId: farm?.ownerId || null,
        plotId: plot?.id || reading.plotId || null,
        cropId: plot?.cropId || null,
        stageId: plot?.stageId || null,
        zoneId: plot?.zoneId || null,
        alert: created,
        reading,
        analysis: candidate.audit,
      });
    }

    return createdAlerts;
  }

  private buildAlertCandidates(
    reading: any,
    previous: any,
    thresholds: ThresholdSet,
    cropName: string | null,
  ): AlertCandidate[] {
    const cropSuffix = cropName ? ` para ${cropName}` : "";
    const candidates: AlertCandidate[] = [];

    const humidityAudit = this.metricAudit(
      reading.humidity,
      previous?.humidity ?? null,
      thresholds.humidityMin,
      thresholds.humidityMax,
      ABRUPT_CHANGE_DELTA.humidity,
    );
    if (humidityAudit.outsideNow) {
      candidates.push({
        type: "humidity",
        message: `Humedad del suelo fuera de rango${cropSuffix} (${this.directionLabel(humidityAudit.direction)})`,
        audit: {
          metric: "humidity",
          threshold_crossed: humidityAudit.crossedRange,
          abrupt_change: humidityAudit.abruptChange,
          thresholds: { min: thresholds.humidityMin, max: thresholds.humidityMax },
          current: humidityAudit.current,
          previous: humidityAudit.previous,
          crop: cropName,
        },
      });
    }

    const temperatureAudit = this.metricAudit(
      reading.temperature,
      previous?.temperature ?? null,
      thresholds.temperatureMin,
      thresholds.temperatureMax,
      ABRUPT_CHANGE_DELTA.temperature,
    );
    if (temperatureAudit.outsideNow) {
      candidates.push({
        type: "temperature",
        message: `Temperatura del suelo fuera de rango${cropSuffix} (${this.directionLabel(temperatureAudit.direction)})`,
        audit: {
          metric: "temperature",
          threshold_crossed: temperatureAudit.crossedRange,
          abrupt_change: temperatureAudit.abruptChange,
          thresholds: { min: thresholds.temperatureMin, max: thresholds.temperatureMax },
          current: temperatureAudit.current,
          previous: temperatureAudit.previous,
          crop: cropName,
        },
      });
    }

    const phAudit = this.metricAudit(
      reading.ph,
      previous?.ph ?? null,
      thresholds.phMin,
      thresholds.phMax,
      ABRUPT_CHANGE_DELTA.ph,
    );
    if (phAudit.outsideNow) {
      candidates.push({
        type: "ph",
        message: `pH fuera de rango${cropSuffix} (${this.directionLabel(phAudit.direction)})`,
        audit: {
          metric: "ph",
          threshold_crossed: phAudit.crossedRange,
          abrupt_change: phAudit.abruptChange,
          thresholds: { min: thresholds.phMin, max: thresholds.phMax },
          current: phAudit.current,
          previous: phAudit.previous,
          crop: cropName,
        },
      });
    }

    if (reading.ce !== null && reading.ce !== undefined) {
      const ceAudit = this.metricAudit(
        reading.ce,
        previous?.ce ?? null,
        thresholds.ceMin,
        thresholds.ceMax,
        ABRUPT_CHANGE_DELTA.ce,
      );
      if (ceAudit.outsideNow) {
        candidates.push({
          type: "ce",
          message: `CE fuera de rango${cropSuffix} (${this.directionLabel(ceAudit.direction)})`,
          audit: {
            metric: "ce",
            threshold_crossed: ceAudit.crossedRange,
            abrupt_change: ceAudit.abruptChange,
            thresholds: { min: thresholds.ceMin, max: thresholds.ceMax },
            current: ceAudit.current,
            previous: ceAudit.previous,
            crop: cropName,
          },
        });
      }
    }

    const nAudit = this.metricAudit(
      reading.n,
      previous?.n ?? null,
      thresholds.nMin,
      thresholds.nMax,
      ABRUPT_CHANGE_DELTA.n,
    );
    const pAudit = this.metricAudit(
      reading.p,
      previous?.p ?? null,
      thresholds.pMin,
      thresholds.pMax,
      ABRUPT_CHANGE_DELTA.p,
    );
    const kAudit = this.metricAudit(
      reading.k,
      previous?.k ?? null,
      thresholds.kMin,
      thresholds.kMax,
      ABRUPT_CHANGE_DELTA.k,
    );

    const npkOut = [
      { nutrient: "N", audit: nAudit },
      { nutrient: "P", audit: pAudit },
      { nutrient: "K", audit: kAudit },
    ].filter((item) => item.audit.outsideNow);

    if (npkOut.length) {
      const nutrientLabel = npkOut.map((item) => item.nutrient).join("-");
      const direction = this.aggregateDirection(npkOut.map((item) => item.audit.direction));
      candidates.push({
        type: "npk",
        message: `NPK fuera de rango${cropSuffix} (${nutrientLabel}, ${direction})`,
        audit: {
          metric: "npk",
          nutrients_outside: nutrientLabel,
          threshold_crossed: npkOut.some((item) => item.audit.crossedRange),
          abrupt_change: npkOut.some((item) => item.audit.abruptChange),
          values: {
            n: reading.n,
            p: reading.p,
            k: reading.k,
          },
          previous_values: {
            n: nAudit.previous,
            p: pAudit.previous,
            k: kAudit.previous,
          },
          thresholds: {
            n: { min: thresholds.nMin, max: thresholds.nMax },
            p: { min: thresholds.pMin, max: thresholds.pMax },
            k: { min: thresholds.kMin, max: thresholds.kMax },
          },
          crop: cropName,
        },
      });
    }

    return candidates;
  }

  private metricAudit(
    currentRaw: unknown,
    previousRaw: unknown,
    min: number,
    max: number,
    abruptDelta: number,
  ): MetricAudit {
    const current = this.toNumber(currentRaw);
    const previous = this.toNumber(previousRaw);

    const outsideNow = current !== null ? current < min || current > max : false;
    const outsidePrevious = previous !== null ? previous < min || previous > max : false;
    const crossedRange = outsideNow && !outsidePrevious;
    const abruptChange = previous !== null ? Math.abs(current - previous) >= abruptDelta : false;
    const direction = !outsideNow ? null : current < min ? "low" : "high";

    return {
      outsideNow,
      crossedRange,
      abruptChange,
      direction,
      current,
      previous,
      min,
      max,
    };
  }

  private directionLabel(direction: "low" | "high" | null) {
    if (direction === "low") return "baja";
    if (direction === "high") return "alta";
    return "mixta";
  }

  private aggregateDirection(directions: Array<"low" | "high" | null>) {
    const unique = Array.from(new Set(directions.filter((item): item is "low" | "high" => Boolean(item))));
    if (unique.length === 1) return this.directionLabel(unique[0]);
    return "mixta";
  }

  private async resolveThresholdProfile(farmId: string, plotId: string | null) {
    if (plotId) {
      const plotLevel = await this.prisma.thresholdProfile.findFirst({
        where: { farmId, plotId },
        orderBy: { createdAt: "desc" },
      });
      if (plotLevel) return plotLevel;
    }

    return this.prisma.thresholdProfile.findFirst({
      where: { farmId, plotId: null },
      orderBy: { createdAt: "desc" },
    });
  }

  private resolveThresholds(profile: any, cropName: string | null): ThresholdSet {
    const cropKey = normalizeCropKey(cropName);
    const cropThresholds = CROP_THRESHOLD_OVERRIDES[cropKey] || {};
    const profileThresholds = this.toThresholdSet(profile);

    return {
      ...DEFAULT_THRESHOLDS,
      ...cropThresholds,
      ...profileThresholds,
    };
  }

  private toThresholdSet(profile: any): Partial<ThresholdSet> {
    if (!profile || typeof profile !== "object") return {};

    return {
      humidityMin: this.readFinite(profile.humidityMin),
      humidityMax: this.readFinite(profile.humidityMax),
      temperatureMin: this.readFinite(profile.temperatureMin),
      temperatureMax: this.readFinite(profile.temperatureMax),
      phMin: this.readFinite(profile.phMin),
      phMax: this.readFinite(profile.phMax),
      ceMin: this.readFinite(profile.ceMin),
      ceMax: this.readFinite(profile.ceMax),
      nMin: this.readFinite(profile.nMin),
      nMax: this.readFinite(profile.nMax),
      pMin: this.readFinite(profile.pMin),
      pMax: this.readFinite(profile.pMax),
      kMin: this.readFinite(profile.kMin),
      kMax: this.readFinite(profile.kMax),
    };
  }

  private readFinite(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private async fetchPreviousReading(reading: any) {
    const where = {
      farmId: reading.farmId,
      ...(reading.plotId ? { plotId: reading.plotId } : { plotId: null }),
      id: { not: reading.id },
    };

    return this.prisma.sensorReading.findFirst({
      where,
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        timestamp: true,
        humidity: true,
        temperature: true,
        ph: true,
        ce: true,
        n: true,
        p: true,
        k: true,
      },
    });
  }

  private toNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async hasOpenAlertSameReason(
    farmId: string,
    plotId: string | null | undefined,
    type: string,
    message: string,
  ) {
    const existing = await this.prisma.alert.findFirst({
      where: {
        farmId,
        plotId: plotId ?? null,
        type: type as any,
        message,
        status: { in: ["open", "acknowledged"] },
      },
      select: { id: true },
    });
    return Boolean(existing);
  }

  private async hasOpenDeviceAlertSameReason(deviceId: string, type: string, message: string) {
    const existing = await this.prisma.alert.findFirst({
      where: {
        deviceId,
        type: type as any,
        message,
        status: "open",
      },
      select: { id: true },
    });

    return Boolean(existing);
  }

  private readEnvNumber(name: string, fallback: number) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private async createIrrigationReportIfNeeded(input: {
    ownerId: string | null;
    plotId: string | null;
    cropId: string | null;
    stageId: string | null;
    zoneId: string | null;
    alert: any;
    reading: any;
    analysis: Record<string, unknown>;
  }) {
    if (!input.ownerId) return;

    const summary = `Alerta de riego: ${input.alert.message}`;
    const existing = await this.prisma.report.findFirst({
      where: {
        userId: input.ownerId,
        summary,
        status: "open",
        ...(input.plotId ? { parcelId: input.plotId } : { parcelId: null }),
      },
      select: { id: true },
    });
    if (existing) return;

    const recipe = this.recipeFromAlertType(input.alert.type, input.alert.message);
    await this.prisma.report.create({
      data: {
        userId: input.ownerId,
        parcelId: input.plotId ?? undefined,
        cropId: input.cropId ?? undefined,
        stageId: input.stageId ?? undefined,
        zoneId: input.zoneId ?? undefined,
        imageUrl: "about:blank",
        audioUrl: null,
        summary,
        actions: recipe.actions,
        prevention: recipe.prevention,
        doNotDo: recipe.doNotDo,
        redFlags: recipe.redFlags,
        productsSuggested: recipe.productsSuggested,
        confidence: "med",
        audit: {
          recipe_source: "irrigation_alert",
          irrigation_alert: {
            alertId: input.alert.id,
            type: input.alert.type,
            message: input.alert.message,
            readingId: input.reading?.id || null,
            analysis: input.analysis,
          },
        } as any,
      },
    });
  }

  private recipeFromAlertType(type: string, message: string) {
    const common = {
      doNotDo: [
        "No dupliques riego sin verificar humedad actual del suelo.",
        "No cambies dosis de fertilizacion sin revisar la causa.",
      ],
      productsSuggested: [
        {
          type: "general",
          purpose: "Ajuste de riego",
          note: "Aplica ajustes graduales y monitorea la siguiente lectura.",
        },
      ],
    };

    if (type === "humidity") {
      return {
        actions: [
          "Revisa humedad en diferentes puntos de la parcela.",
          "Ajusta tiempo de riego por sectores, no de forma general.",
          "Verifica uniformidad del sistema de riego.",
        ],
        prevention: [
          "Monitorea humedad al menos 2 veces por dia en horas clave.",
          "Manten registro de riego aplicado y respuesta del suelo.",
        ],
        redFlags: [
          "Humedad fuera de rango en lecturas consecutivas.",
          "Marchitez visible aun despues de ajustar riego.",
        ],
        ...common,
      };
    }

    if (type === "temperature") {
      return {
        actions: [
          "Revisa temperatura del suelo en la manana y tarde.",
          "Ajusta riego para evitar extremos termicos en la rizosfera.",
        ],
        prevention: [
          "Evita riegos intensos en horas de maxima radiacion.",
          "Usa cobertura vegetal para estabilizar temperatura del suelo.",
        ],
        redFlags: [
          "Temperatura de suelo fuera de rango por mas de 2 ciclos de lectura.",
          "Signos de estres termico en hojas nuevas.",
        ],
        ...common,
      };
    }

    if (type === "ph" || type === "ce" || type === "npk") {
      return {
        actions: [
          "Confirma lectura con una segunda medicion en otro punto.",
          "Ajusta riego para reducir concentracion de sales en zona radicular.",
          "Evalua compatibilidad de fertilizacion con etapa del cultivo.",
        ],
        prevention: [
          "Programa lavado preventivo si la CE sigue en aumento.",
          "Revisa plan de fertilizacion segun etapa y demanda del cultivo.",
        ],
        redFlags: [
          "Incremento continuo de CE o desbalance NPK en lecturas consecutivas.",
          "Sintomas de toxicidad o deficiencia nutricional visibles.",
        ],
        ...common,
      };
    }

    return {
      actions: ["Revisa condiciones de riego y vuelve a medir en las proximas horas.", message],
      prevention: ["Manten monitoreo continuo para evitar repeticion de la alerta."],
      redFlags: ["La misma alerta aparece en lecturas consecutivas por mas de 24 horas."],
      ...common,
    };
  }
}
