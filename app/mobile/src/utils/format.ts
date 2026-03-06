import { AlertItem, LatestReading, SourceNow, SystemLevel } from "../types/aerogen";
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

export const temperatureState = (tempC: number | null | undefined, language: AppLanguage = "es") => {
  if (tempC === null || tempC === undefined) {
    return { label: translate(language, "format.temperature.noData"), level: "warn" as SystemLevel };
  }
  if (tempC < 60) return { label: translate(language, "format.temperature.normal"), level: "ok" as SystemLevel };
  if (tempC <= 80) return { label: translate(language, "format.temperature.care"), level: "warn" as SystemLevel };
  return { label: translate(language, "format.temperature.danger"), level: "stop" as SystemLevel };
};

export const vibrationState = (rms: number | null | undefined, language: AppLanguage = "es") => {
  if (rms === null || rms === undefined) {
    return { label: translate(language, "format.vibration.noData"), level: "warn" as SystemLevel };
  }
  if (rms < 4) return { label: translate(language, "format.vibration.normal"), level: "ok" as SystemLevel };
  if (rms < 6) return { label: translate(language, "format.vibration.soon"), level: "warn" as SystemLevel };
  return { label: translate(language, "format.vibration.review"), level: "stop" as SystemLevel };
};

export const voltageState = (voltage: number | null | undefined, language: AppLanguage = "es") => {
  if (voltage === null || voltage === undefined) {
    return { label: translate(language, "format.voltage.noData"), level: "warn" as SystemLevel };
  }
  if (voltage < 30) return { label: translate(language, "format.voltage.fault"), level: "stop" as SystemLevel };
  if (voltage < 44) return { label: translate(language, "format.voltage.low"), level: "warn" as SystemLevel };
  return { label: translate(language, "format.voltage.normal"), level: "ok" as SystemLevel };
};

export const sourceLabel = (sourceNow: SourceNow | null | undefined, language: AppLanguage = "es") => {
  if (sourceNow === "WIND") return translate(language, "format.source.WIND");
  if (sourceNow === "BATTERY") return translate(language, "format.source.BATTERY");
  if (sourceNow === "BOTH") return translate(language, "format.source.BOTH");
  return translate(language, "format.source.UNKNOWN");
};

export const systemState = (reading: LatestReading | null, language: AppLanguage = "es") => {
  if (!reading) {
    return {
      level: "warn" as SystemLevel,
      title: translate(language, "format.system.noData.title"),
      message: translate(language, "format.system.noData.message"),
    };
  }

  if ((reading.windSpeedMs ?? 0) > 20 || (reading.genTempC ?? 0) > 80) {
    return {
      level: "stop" as SystemLevel,
      title: translate(language, "format.system.stop.title"),
      message: translate(language, "format.system.stop.message"),
    };
  }

  if ((reading.vibrationRms ?? 0) >= 6 || (reading.batteryPct ?? 100) < 20) {
    return {
      level: "warn" as SystemLevel,
      title: translate(language, "format.system.warn.title"),
      message: translate(language, "format.system.warn.message"),
    };
  }

  if ((reading.windSpeedMs ?? 0) < 3) {
    return {
      level: "warn" as SystemLevel,
      title: translate(language, "format.system.lowWind.title"),
      message: translate(language, "format.system.lowWind.message"),
    };
  }

  return {
    level: "ok" as SystemLevel,
    title: translate(language, "format.system.ok.title"),
    message: translate(language, "format.system.ok.message"),
  };
};

export const energyEquivalences = (kwh: number | null | undefined) => {
  const normalized = Math.max(0, Number(kwh || 0));
  const phones = Math.round(normalized * 10);
  const fieldLightsHours = Math.round((normalized * 1000) / 120);
  return { phones, fieldLightsHours };
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

const weekLabelsByLanguage: Record<AppLanguage, string[]> = {
  es: ["L", "M", "X", "J", "V", "S", "D"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
  qu: ["L", "M", "X", "J", "V", "S", "D"],
};

export const weeklyEnergySeries = (energyTodayKwh: number | null | undefined, language: AppLanguage = "es") => {
  const base = Math.max(0.6, Number(energyTodayKwh || 0));
  const labels = weekLabelsByLanguage[language] || weekLabelsByLanguage.es;
  const dateSeed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  return labels.map((label, index) => {
    if (index === labels.length - 1) {
      return { label, kwh: Number(base.toFixed(2)) };
    }

    const waveA = Math.sin((dateSeed + index * 17) * 0.017) * 0.16;
    const waveB = Math.cos((dateSeed + index * 29) * 0.011) * 0.08;
    const weekendBoost = index >= 4 ? 0.05 : 0;
    const factor = clamp(0.82 + waveA + waveB + weekendBoost, 0.55, 1.2);

    return {
      label,
      kwh: Number((base * factor).toFixed(2)),
    };
  });
};

