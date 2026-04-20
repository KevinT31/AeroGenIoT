import {
  AlarmItem,
  ComponentState,
  ConnectivityStatus,
  DigitalTwinState,
  MaintenanceItem,
  TelemetryPoint,
  TimeRange,
} from "@/types/dashboard";
import {
  DashboardLanguage,
  translateDashboard,
} from "@/i18n/translations";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const wrapAngle = (value: number) => ((value % 360) + 360) % 360;
const wave = (minutes: number, periodMinutes: number, phase = 0) =>
  Math.sin(((minutes / periodMinutes) + phase) * Math.PI * 2);
const positive = (value: number) => (value + 1) / 2;

const BATTERY_CAPACITY_KWH = 4.8;
const INVERTER_EFFICIENCY = 0.93;
const WIND_CUT_IN_MPS = 2.3;
const WIND_RATED_MPS = 11;
const MAX_GENERATION_W = 1700;
const MAX_ROTOR_RPM = 760;

const rangeCount: Record<TimeRange, number> = {
  "1h": 12,
  "6h": 24,
  "24h": 36,
  "7d": 42,
};

const rangeStepMinutes: Record<TimeRange, number> = {
  "1h": 5,
  "6h": 15,
  "24h": 40,
  "7d": 240,
};

export const createSyntheticHistory = (latest: TelemetryPoint | null, range: TimeRange): TelemetryPoint[] => {
  const count = rangeCount[range];
  const stepMinutes = rangeStepMinutes[range];
  const anchor = latest?.timestamp ? new Date(latest.timestamp) : new Date();
  const points = Array.from({ length: count }, (_, index) => {
    const age = count - index - 1;
    const timestamp = new Date(anchor.getTime() - age * stepMinutes * 60_000);
    return buildSyntheticTelemetryPoint(timestamp);
  });

  if (latest) {
    points[points.length - 1] = {
      ...points[points.length - 1],
      ...latest,
      timestamp: anchor.toISOString(),
    };
  }

  return points;
};

export const buildMockLatest = (): TelemetryPoint => {
  return buildSyntheticTelemetryPoint(new Date());
};

const buildSyntheticTelemetryPoint = (timestamp: Date): TelemetryPoint => {
  const minuteCursor = timestamp.getTime() / 60_000;
  const hourOfDay = timestamp.getHours() + timestamp.getMinutes() / 60 + timestamp.getSeconds() / 3600;

  const windSlow = wave(minuteCursor, 180, 0.14);
  const windMid = wave(minuteCursor, 58, -0.19);
  const windFast = wave(minuteCursor, 13, 0.31);
  const gust = Math.max(0, wave(minuteCursor, 6.5, -0.07));
  const demandSlow = wave(minuteCursor, 145, 0.23);
  const demandFast = wave(minuteCursor, 37, -0.11);
  const batterySlow = wave(minuteCursor, 720, 0.18);

  const eveningPeak =
    (hourOfDay >= 18 && hourOfDay <= 23 ? 1 : 0) * 220 +
    (hourOfDay >= 0 && hourOfDay < 5 ? -130 : 0);

  const windSpeedMs = clamp(6.1 + windSlow * 2.7 + windMid * 1.4 + windFast * 0.6 + gust * 1.25, 0.8, 15.5);
  const windDirectionDeg = wrapAngle(214 + windSlow * 62 + windMid * 24 + windFast * 8);

  const windRatio = clamp(
    (windSpeedMs - WIND_CUT_IN_MPS) / Math.max(WIND_RATED_MPS - WIND_CUT_IN_MPS, 0.1),
    0,
    1.18,
  );

  const rotorRpm =
    windSpeedMs < WIND_CUT_IN_MPS
      ? clamp((windSpeedMs / WIND_CUT_IN_MPS) * 54 + gust * 8, 0, 85)
      : clamp(96 + Math.pow(windRatio, 1.15) * 558 + gust * 42 + windMid * 8, 0, MAX_ROTOR_RPM);

  const generationEfficiency = clamp(0.9 - Math.max(0, windFast) * 0.05, 0.76, 0.92);
  const generatedPowerW =
    windSpeedMs < WIND_CUT_IN_MPS
      ? 0
      : clamp(70 + Math.pow(windRatio, 1.52) * MAX_GENERATION_W * generationEfficiency + gust * 55, 0, MAX_GENERATION_W);

  const loadPowerW = clamp(560 + demandSlow * 145 + demandFast * 58 + eveningPeak, 180, 2100);
  const dcRequiredW = loadPowerW / INVERTER_EFFICIENCY;
  const batteryPowerW = clamp(dcRequiredW - generatedPowerW, -1100, 1400);

  const batteryPct = clamp(
    56 + batterySlow * 24 - Math.max(batteryPowerW, 0) / 55 + Math.max(-batteryPowerW, 0) / 95 + demandFast * 3,
    10,
    97,
  );

  const outputVoltageAcV = clamp(
    229.5 - loadPowerW / 900 * 2.4 - (batteryPct < 20 ? 4.5 : 0) + wave(minuteCursor, 28, 0.41) * 1.8,
    205,
    233,
  );
  const outputCurrentAcA = clamp(loadPowerW / Math.max(outputVoltageAcV, 1), 0, 11);

  const genVoltageV = windSpeedMs < 1
    ? 0
    : clamp(24 + windSpeedMs * 2.25 + gust * 1.1 + windMid * 0.5, 8, 58);
  const genCurrentA = generatedPowerW > 0 ? clamp(generatedPowerW / Math.max(genVoltageV, 1), 0, 36) : 0;

  const vibrationRms = clamp(
    0.55 + rotorRpm * 0.0053 + gust * 0.45 + Math.max(0, generatedPowerW - 1100) / 500 + Math.max(0, loadPowerW - 1200) / 900,
    0.2,
    8.7,
  );
  const vibrationSignal = clamp(vibrationRms / 10 + wave(minuteCursor, 9, 0.22) * 0.025, 0.05, 1.2);

  const genTempC = clamp(
    24 + generatedPowerW / 56 + loadPowerW / 230 + Math.max(0, batteryPowerW) / 230 + gust * 1.4,
    24,
    92,
  );

  const availableKwh = BATTERY_CAPACITY_KWH * (batteryPct / 100) * 0.92;
  const estimatedAutonomyHours = loadPowerW > 40 ? clamp(availableKwh / (loadPowerW / 1000), 0, 18) : null;

  const dayProgress = (hourOfDay % 24) / 24;
  const projectedDailyKwh = 5.6 + positive(windSlow) * 3.1 + positive(windMid) * 0.9;
  const energyTodayKwh = clamp(projectedDailyKwh * dayProgress, 0, 18);

  let sourceNow: TelemetryPoint["sourceNow"] = "BOTH";
  let sourceReason = "Wind generation covers most of the load while the battery smooths demand peaks.";
  let mode = "balanced";

  if (windSpeedMs < 3) {
    sourceNow = "BATTERY";
    sourceReason = "Low wind keeps the battery supporting the household load.";
    mode = "low_wind";
  } else if (batteryPowerW <= -90) {
    sourceNow = "WIND";
    sourceReason = "Wind generation is covering the load and recharging the battery.";
    mode = windSpeedMs > 10.5 ? "strong_wind" : "balanced";
  } else if (loadPowerW > 1350) {
    sourceNow = "BOTH";
    sourceReason = "Household demand is high, so wind and battery are sharing the supply.";
    mode = "high_load";
  } else if (hourOfDay < 6 && loadPowerW < 450) {
    mode = "night_low_load";
  } else if (batteryPct < 24 && batteryPowerW > 120) {
    mode = "recovery";
  }

  return {
    timestamp: timestamp.toISOString(),
    windSpeedMs: round(windSpeedMs, 2),
    windDirectionDeg: round(windDirectionDeg, 0),
    genVoltageV: round(genVoltageV, 2),
    genCurrentA: round(genCurrentA, 2),
    outputVoltageAcV: round(outputVoltageAcV, 1),
    outputCurrentAcA: round(outputCurrentAcA, 2),
    vibrationRms: round(vibrationRms, 2),
    vibrationSignal: round(vibrationSignal, 3),
    genTempC: round(genTempC, 2),
    rotorRpm: round(rotorRpm, 0),
    batteryPct: round(batteryPct, 0),
    estimatedAutonomyHours: estimatedAutonomyHours === null ? null : round(estimatedAutonomyHours, 1),
    loadPowerW: round(loadPowerW, 0),
    powerW: round(batteryPowerW, 0),
    energyTodayKwh: round(energyTodayKwh, 2),
    sourceNow,
    sourceReason,
    mode,
  };
};

export const buildMockAlarms = (
  language: DashboardLanguage = "en",
): AlarmItem[] => {
  const now = Date.now();
  return [
    {
      id: "alarm-warning-01",
      type: "controller_overload",
      rawType: "controller_overload",
      severity: "warning",
      title: translateDashboard(language, "alarm.title.controller_overload"),
      description:
        language === "es"
          ? "El controlador registro una sobrecarga puntual mientras la bateria sostenia la vivienda."
          : "The controller logged a brief overload while the battery supported the household.",
      timestamp: new Date(now - 95 * 60_000).toISOString(),
      status: "acknowledged",
      deviceId: "AE-01",
      suggestedAction: translateDashboard(language, "alarm.action.controller_overload"),
    },
    {
      id: "alarm-resolved-01",
      type: "supply_cut",
      rawType: "supply_cut",
      severity: "warning",
      title: translateDashboard(language, "alarm.title.supply_cut"),
      description:
        language === "es"
          ? "La salida AC se interrumpio por un intervalo corto y luego se recupero."
          : "AC output was interrupted for a short interval and then recovered.",
      timestamp: new Date(now - 6 * 60 * 60_000).toISOString(),
      status: "resolved",
      deviceId: "AE-01",
      suggestedAction: translateDashboard(language, "alarm.action.supply_cut"),
    },
    {
      id: "alarm-resolved-02",
      type: "inverter_fault",
      rawType: "inverter_fault",
      severity: "warning",
      title: translateDashboard(language, "alarm.title.inverter_fault"),
      description:
        language === "es"
          ? "Se detecto una falla transitoria del inversor en la madrugada y quedo registrada para revision."
          : "A transient inverter fault was detected overnight and logged for review.",
      timestamp: new Date(now - 19 * 60 * 60_000).toISOString(),
      status: "resolved",
      deviceId: "AE-01",
      suggestedAction: translateDashboard(language, "alarm.action.inverter_fault"),
    },
  ];
};

export const buildMockMaintenance = (
  language: DashboardLanguage = "en",
): MaintenanceItem[] => {
  const now = Date.now();
  return [
    {
      id: "mnt-corrective-01",
      category: "corrective",
      title: translateDashboard(language, "maintenance.item.corrective.generator.title"),
      description:
        language === "es"
          ? "La temperatura del inversor sigue alta y la vibracion exige una revision correctiva en campo."
          : "Inverter temperature remains high and vibration calls for corrective field inspection.",
      priority: "critical",
      status: "new",
      component: "Inverter and rotor support",
      sourceRule: "temp-above-threshold",
      createdAt: new Date(now - 20 * 60_000).toISOString(),
      dueDate: new Date(now + 4 * 60 * 60_000).toISOString(),
      recommendedAction: translateDashboard(language, "maintenance.item.corrective.generator.action"),
    },
    {
      id: "mnt-preventive-01",
      category: "preventive",
      title: translateDashboard(language, "maintenance.item.preventive.electrical.title"),
      description:
        language === "es"
          ? "Inspeccion rutinaria de salida AC, tablero y cableado hacia la vivienda."
          : "Routine inspection of AC output, board and wiring toward the household.",
      priority: "medium",
      status: "scheduled",
      component: "Electrical system",
      sourceRule: "calendar-weekly",
      createdAt: new Date(now - 2 * 24 * 60 * 60_000).toISOString(),
      dueDate: new Date(now + 2 * 24 * 60 * 60_000).toISOString(),
      recommendedAction: translateDashboard(language, "maintenance.item.preventive.electrical.action"),
    },
    {
      id: "mnt-predictive-01",
      category: "predictive",
      title: translateDashboard(language, "maintenance.item.predictive.rotor.title"),
      description:
        language === "es"
          ? "La combinacion de vibracion y RPM sugiere revisar balance y apriete del conjunto rotativo."
          : "The combination of vibration and RPM suggests checking balance and fasteners on the rotating assembly.",
      priority: "high",
      status: "in_progress",
      component: "Rotor",
      sourceRule: "vibration-trend-slope",
      createdAt: new Date(now - 10 * 60 * 60_000).toISOString(),
      dueDate: new Date(now + 18 * 60 * 60_000).toISOString(),
      recommendedAction: translateDashboard(language, "maintenance.item.predictive.rotor.action"),
    },
  ];
};

export const buildMockTwin = (connectivityStatus: ConnectivityStatus = "live"): DigitalTwinState => {
  const status = (value: ComponentState): ComponentState => (connectivityStatus === "offline" ? "offline" : value);
  return {
    rotorStatus: status("warning"),
    generatorStatus: status("warning"),
    towerStatus: status("normal"),
    electricalStatus: status("warning"),
    batteryStatus: status("warning"),
    sensorsStatus: status("normal"),
    connectivityStatus: connectivityStatus === "offline" ? "offline" : "normal",
    windDirectionDeg: 236,
    windDirectionStatus: status("normal"),
    temperatureStatus: status("warning"),
    vibrationStatus: status("warning"),
    voltageStatus: status("warning"),
    powerFlowLevel: 0.48,
    animationLevel: 0.34,
    highlights: ["battery", "electrical", "rotor"],
    warnings: ["Low wind, battery is supporting supply", "Inverter temperature remains above preferred range"],
  };
};
