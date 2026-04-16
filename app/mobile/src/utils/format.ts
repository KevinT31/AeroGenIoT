import { AlertItem, SystemLevel, TelemetryReading } from "../types/aerogen";
import { AppLanguage, translate } from "../i18n/translations";

export const round = (value: number | null | undefined, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return Number(value).toFixed(digits);
};

export const timeAgo = (value: string | Date | null | undefined, language: AppLanguage = "es") => {
  if (!value) return translate(language, "format.time.noData");
  const now = Date.now();
  const date = typeof value === "string" ? new Date(value).getTime() : value.getTime();
  if (!Number.isFinite(date)) return translate(language, "format.time.noData");
  const diff = Math.max(0, now - date);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return translate(language, "format.time.seconds");
  const min = Math.floor(sec / 60);
  if (min < 60) return translate(language, "format.time.minutes", { value: min });
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return translate(language, "format.time.hours", { value: hrs });
  const days = Math.floor(hrs / 24);
  return translate(language, "format.time.days", { value: days });
};

export const windState = (windSpeedMs: number | null | undefined, language: AppLanguage = "es") => {
  if (windSpeedMs === null || windSpeedMs === undefined) {
    return {
      label: translate(language, "format.wind.noData.label"),
      message: translate(language, "format.wind.noData.message"),
    };
  }
  if (windSpeedMs < 3) {
    return {
      label: translate(language, "format.wind.low.label"),
      message: translate(language, "format.wind.low.message"),
    };
  }
  if (windSpeedMs <= 12) {
    return {
      label: translate(language, "format.wind.optimal.label"),
      message: translate(language, "format.wind.optimal.message"),
    };
  }
  if (windSpeedMs > 20) {
    return {
      label: translate(language, "format.wind.risk.label"),
      message: translate(language, "format.wind.risk.message"),
    };
  }
  return {
    label: translate(language, "format.wind.medium.label"),
    message: translate(language, "format.wind.medium.message"),
  };
};

export const windDirectionLabel = (degrees: number | null | undefined, language: AppLanguage = "es") => {
  if (degrees === null || degrees === undefined || Number.isNaN(degrees)) {
    return translate(language, "format.direction.noData");
  }

  const directions = [
    "format.direction.n",
    "format.direction.ne",
    "format.direction.e",
    "format.direction.se",
    "format.direction.s",
    "format.direction.sw",
    "format.direction.w",
    "format.direction.nw",
  ];

  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % directions.length;
  return translate(language, directions[index]);
};

export const temperatureState = (tempC: number | null | undefined, language: AppLanguage = "es") => {
  if (tempC === null || tempC === undefined) {
    return { label: translate(language, "format.temperature.noData"), level: "warn" as SystemLevel };
  }
  if (tempC < 55) return { label: translate(language, "format.temperature.normal"), level: "ok" as SystemLevel };
  if (tempC <= 70) return { label: translate(language, "format.temperature.care"), level: "warn" as SystemLevel };
  return { label: translate(language, "format.temperature.danger"), level: "stop" as SystemLevel };
};

export const vibrationState = (rms: number | null | undefined, language: AppLanguage = "es") => {
  if (rms === null || rms === undefined) {
    return { label: translate(language, "format.vibration.noData"), level: "warn" as SystemLevel };
  }
  if (rms < 4) return { label: translate(language, "format.vibration.normal"), level: "ok" as SystemLevel };
  if (rms < 7) return { label: translate(language, "format.vibration.soon"), level: "warn" as SystemLevel };
  return { label: translate(language, "format.vibration.review"), level: "stop" as SystemLevel };
};

export const voltageState = (voltage: number | null | undefined, language: AppLanguage = "es") => {
  if (voltage === null || voltage === undefined) {
    return { label: translate(language, "format.voltage.noData"), level: "warn" as SystemLevel };
  }
  if (voltage < 42 || voltage > 58) return { label: translate(language, "format.voltage.fault"), level: "stop" as SystemLevel };
  if (voltage < 46 || voltage > 55) return { label: translate(language, "format.voltage.low"), level: "warn" as SystemLevel };
  return { label: translate(language, "format.voltage.normal"), level: "ok" as SystemLevel };
};

export const acVoltageState = (voltage: number | null | undefined, language: AppLanguage = "es") => {
  if (voltage === null || voltage === undefined) {
    return { label: translate(language, "format.acVoltage.noData"), level: "warn" as SystemLevel };
  }
  if (voltage < 190 || voltage > 250) return { label: translate(language, "format.acVoltage.fault"), level: "stop" as SystemLevel };
  if (voltage < 210 || voltage > 240) return { label: translate(language, "format.acVoltage.low"), level: "warn" as SystemLevel };
  return { label: translate(language, "format.acVoltage.normal"), level: "ok" as SystemLevel };
};

export const rpmState = (rpm: number | null | undefined, language: AppLanguage = "es") => {
  if (rpm === null || rpm === undefined) {
    return { label: translate(language, "format.rpm.noData"), level: "warn" as SystemLevel };
  }
  if (rpm >= 750) return { label: translate(language, "format.rpm.high"), level: "stop" as SystemLevel };
  if (rpm >= 600) return { label: translate(language, "format.rpm.watch"), level: "warn" as SystemLevel };
  return { label: translate(language, "format.rpm.normal"), level: "ok" as SystemLevel };
};

export const energyEquivalences = (kwh: number | null | undefined) => {
  const normalized = Math.max(0, Number(kwh || 0));
  const phones = Math.round(normalized * 10);
  const fieldLightsHours = Math.round((normalized * 1000) / 120);
  const pumpHours = Math.round((normalized * 1000) / 550);
  return { phones, fieldLightsHours, pumpHours };
};

export const estimateAutonomyHours = (
  batteryPct: number | null | undefined,
  loadPowerW: number | null | undefined,
  batteryCapacityKwh: number,
) => {
  if (batteryPct === null || batteryPct === undefined) return null;
  if (!loadPowerW || loadPowerW <= 0) return null;
  const availableKwh = Math.max(0, batteryCapacityKwh * (batteryPct / 100));
  const hours = availableKwh / (loadPowerW / 1000);
  return Number.isFinite(hours) ? Math.max(0, hours) : null;
};

export const sortAlertsByDate = (alerts: AlertItem[]) =>
  [...alerts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

export const getReadingTimestamp = (reading: TelemetryReading | null) => {
  const raw = reading?.ts || reading?.createdAt || null;
  if (!raw) return null;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

export const isReadingStale = (reading: TelemetryReading | null, staleAfterMs: number) => {
  const timestamp = getReadingTimestamp(reading);
  if (!timestamp) return true;
  return Date.now() - timestamp > staleAfterMs;
};
