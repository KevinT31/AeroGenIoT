import { AlertItem, TelemetryReading } from "../types/aerogen";

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

type MockAlertSeed = {
  idSuffix: string;
  type: AlertItem["type"];
  rawType: AlertItem["rawType"];
  status: AlertItem["status"];
  message: string;
  severity: AlertItem["severity"];
  createdOffsetMinutes: number;
  updatedOffsetMinutes: number;
};

const alertSeeds: MockAlertSeed[] = [
  {
    idSuffix: "battery-low",
    type: "battery_low",
    rawType: "battery_low",
    status: "open",
    message: "Bateria baja: use la energia con cuidado.",
    severity: "warn",
    createdOffsetMinutes: 8,
    updatedOffsetMinutes: 3,
  },
  {
    idSuffix: "low-wind",
    type: "low_wind",
    rawType: "low_wind",
    status: "open",
    message: "Hay poco viento: la bateria esta apoyando la vivienda.",
    severity: "warn",
    createdOffsetMinutes: 22,
    updatedOffsetMinutes: 8,
  },
  {
    idSuffix: "inverter-temp",
    type: "inverter_temp_high",
    rawType: "inverter_temp_high",
    status: "open",
    message: "Inversor caliente: revisar ventilacion o carga.",
    severity: "warn",
    createdOffsetMinutes: 28,
    updatedOffsetMinutes: 11,
  },
  {
    idSuffix: "vibration-high",
    type: "vibration_high",
    rawType: "vibration_high",
    status: "open",
    message: "Vibracion alta: posible problema mecanico.",
    severity: "warn",
    createdOffsetMinutes: 41,
    updatedOffsetMinutes: 20,
  },
  {
    idSuffix: "system-overload",
    type: "system_overload",
    rawType: "system_overload",
    status: "acknowledged",
    message: "Demasiado consumo: desconecte algunos equipos.",
    severity: "warn",
    createdOffsetMinutes: 165,
    updatedOffsetMinutes: 142,
  },
  {
    idSuffix: "high-wind",
    type: "high_wind",
    rawType: "high_wind",
    status: "resolved",
    message: "Viento fuerte: el sistema estuvo en condicion exigente.",
    severity: "warn",
    createdOffsetMinutes: 380,
    updatedOffsetMinutes: 320,
  },
];

let mockAlertsState: AlertItem[] | null = null;
let mockAlertsDeviceId: string | null = null;

const isoMinutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const createAlertFromSeed = (seed: MockAlertSeed, deviceId: string): AlertItem => ({
  id: `mock-alert-${deviceId}-${seed.idSuffix}`,
  deviceId,
  farmId: null,
  plotId: null,
  type: seed.type,
  rawType: seed.rawType,
  status: seed.status,
  message: seed.message,
  createdAt: isoMinutesAgo(seed.createdOffsetMinutes),
  updatedAt: isoMinutesAgo(seed.updatedOffsetMinutes),
  severity: seed.severity,
});

const ensureMockAlerts = (deviceId: string) => {
  if (!mockAlertsState || mockAlertsDeviceId !== deviceId) {
    mockAlertsState = alertSeeds.map((seed) => createAlertFromSeed(seed, deviceId));
    mockAlertsDeviceId = deviceId;
  }

  return mockAlertsState;
};

export const buildMockReading = (deviceId: string): TelemetryReading => {
  const now = new Date();

  return {
    id: `mock-${deviceId}`,
    deviceId,
    farmId: null,
    plotId: null,
    ...buildSyntheticReading(now),
  };
};

export const buildMockAlerts = (deviceId: string): AlertItem[] =>
  ensureMockAlerts(deviceId).map((alert) => ({ ...alert }));

export const acknowledgeMockAlert = (alertId: string) => {
  if (!mockAlertsState) return null;

  let updatedAlert: AlertItem | null = null;
  mockAlertsState = mockAlertsState.map((alert) => {
    if (alert.id !== alertId) return alert;

    const nextAlert: AlertItem = {
      ...alert,
      status: "acknowledged",
      updatedAt: new Date().toISOString(),
    };

    updatedAlert = nextAlert;
    return nextAlert;
  });

  return updatedAlert;
};

const buildSyntheticReading = (timestamp: Date): Omit<TelemetryReading, "id" | "deviceId" | "farmId" | "plotId"> => {
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

  let sourceNow: TelemetryReading["sourceNow"] = "BOTH";
  let sourceReason = "El viento cubre gran parte de la carga y la bateria suaviza los picos.";
  let mode = "balanced";

  if (windSpeedMs < 3) {
    sourceNow = "BATTERY";
    sourceReason = "El viento es bajo y la bateria sostiene la vivienda.";
    mode = "low_wind";
  } else if (batteryPowerW <= -90) {
    sourceNow = "WIND";
    sourceReason = "La generacion eolica cubre la carga y recarga la bateria.";
    mode = windSpeedMs > 10.5 ? "strong_wind" : "balanced";
  } else if (loadPowerW > 1350) {
    sourceNow = "BOTH";
    sourceReason = "La demanda de la vivienda es alta y viento con bateria comparten el suministro.";
    mode = "high_load";
  } else if (hourOfDay < 6 && loadPowerW < 450) {
    mode = "night_low_load";
  } else if (batteryPct < 24 && batteryPowerW > 120) {
    mode = "recovery";
  }

  return {
    ts: timestamp.toISOString(),
    windSpeedMs: round(windSpeedMs, 2),
    windDirectionDeg: round(windDirectionDeg, 0),
    genVoltageV: round(genVoltageV, 2),
    genCurrentA: round(genCurrentA, 2),
    powerW: round(batteryPowerW, 0),
    loadPowerW: round(loadPowerW, 0),
    outputVoltageAcV: round(outputVoltageAcV, 1),
    outputCurrentAcA: round(outputCurrentAcA, 2),
    sourceNow,
    sourceReason,
    vibrationRms: round(vibrationRms, 2),
    vibrationSignal: round(vibrationSignal, 3),
    genTempC: round(genTempC, 2),
    rotorRpm: round(rotorRpm, 0),
    batteryPct: round(batteryPct, 0),
    estimatedAutonomyHours: estimatedAutonomyHours === null ? null : round(estimatedAutonomyHours, 1),
    energyTodayKwh: round(energyTodayKwh, 2),
    mode,
    createdAt: timestamp.toISOString(),
  };
};
