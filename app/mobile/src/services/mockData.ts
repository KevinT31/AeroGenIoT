import { AlertItem, TelemetryReading } from "../types/aerogen";

const baseReading = {
  windSpeedMs: 2.8,
  windDirectionDeg: 236,
  genVoltageV: 45.6,
  genCurrentA: 18.7,
  powerW: 853,
  loadPowerW: 680,
  outputVoltageAcV: 219.4,
  outputCurrentAcA: 3.1,
  sourceNow: "BATTERY" as const,
  sourceReason: "El viento es bajo y la bateria sostiene la vivienda.",
  vibrationRms: 4.36,
  vibrationSignal: 0.472,
  genTempC: 57.8,
  rotorRpm: 618,
  batteryPct: 18,
  estimatedAutonomyHours: 0.8,
  energyTodayKwh: 4.7,
  mode: "mock",
};

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
    ts: now.toISOString(),
    ...baseReading,
    createdAt: now.toISOString(),
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
