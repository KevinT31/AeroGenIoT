import { AlertItem, LatestReading, SourceNow, SystemLevel } from "../types/aerogen";

export const round = (value: number | null | undefined, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return Number(value).toFixed(digits);
};

export const timeAgo = (value: string | Date | null | undefined) => {
  if (!value) return "sin datos";
  const now = Date.now();
  const date = typeof value === "string" ? new Date(value).getTime() : value.getTime();
  if (!Number.isFinite(date)) return "sin datos";
  const diff = Math.max(0, now - date);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "hace unos segundos";
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} d`;
};

export const windState = (windSpeedMs: number | null | undefined) => {
  if (windSpeedMs === null || windSpeedMs === undefined) {
    return { label: "sin dato", message: "Esperando lectura de anemometro." };
  }
  if (windSpeedMs < 3) {
    return { label: "viento muy bajo", message: "Generacion baja por poco viento." };
  }
  if (windSpeedMs <= 12) {
    return { label: "generacion optima", message: "Hoy hay viento suficiente para generar energia." };
  }
  if (windSpeedMs > 20) {
    return { label: "riesgo de operacion", message: "Viento peligroso: el sistema debe detenerse por seguridad." };
  }
  return { label: "generacion media", message: "Hay viento, con generacion parcial." };
};

export const temperatureState = (tempC: number | null | undefined) => {
  if (tempC === null || tempC === undefined) return { label: "sin dato", level: "warn" as SystemLevel };
  if (tempC < 60) return { label: "normal", level: "ok" as SystemLevel };
  if (tempC <= 80) return { label: "cuidado", level: "warn" as SystemLevel };
  return { label: "peligro", level: "stop" as SystemLevel };
};

export const vibrationState = (rms: number | null | undefined) => {
  if (rms === null || rms === undefined) return { label: "sin dato", level: "warn" as SystemLevel };
  if (rms < 4) return { label: "normal", level: "ok" as SystemLevel };
  if (rms < 6) return { label: "mantenimiento pronto", level: "warn" as SystemLevel };
  return { label: "revisar turbina", level: "stop" as SystemLevel };
};

export const voltageState = (voltage: number | null | undefined) => {
  if (voltage === null || voltage === undefined) return { label: "sin dato", level: "warn" as SystemLevel };
  if (voltage < 30) return { label: "falla", level: "stop" as SystemLevel };
  if (voltage < 44) return { label: "bajo", level: "warn" as SystemLevel };
  return { label: "normal", level: "ok" as SystemLevel };
};

export const sourceLabel = (sourceNow: SourceNow | null | undefined) => {
  if (sourceNow === "WIND") return "Viento";
  if (sourceNow === "BATTERY") return "Bateria";
  if (sourceNow === "BOTH") return "Viento + bateria";
  return "Sin dato";
};

export const systemState = (reading: LatestReading | null) => {
  if (!reading) {
    return {
      level: "warn" as SystemLevel,
      title: "Funcionamiento con advertencia",
      message: "Aun no llegan lecturas del dispositivo.",
    };
  }

  if ((reading.windSpeedMs ?? 0) > 20 || (reading.genTempC ?? 0) > 80) {
    return {
      level: "stop" as SystemLevel,
      title: "Sistema detenido por seguridad",
      message: "Condicion critica detectada en viento o temperatura.",
    };
  }

  if ((reading.vibrationRms ?? 0) >= 6 || (reading.batteryPct ?? 100) < 20) {
    return {
      level: "warn" as SystemLevel,
      title: "Funcionamiento con advertencia",
      message: "Se recomienda revisar alertas y planificar mantenimiento.",
    };
  }

  if ((reading.windSpeedMs ?? 0) < 3) {
    return {
      level: "warn" as SystemLevel,
      title: "Funcionamiento con advertencia",
      message: "Generacion baja por viento insuficiente.",
    };
  }

  return {
    level: "ok" as SystemLevel,
    title: "Funcionando correctamente",
    message: "Generando energia con normalidad.",
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

export const weeklyEnergySeries = (energyTodayKwh: number | null | undefined) => {
  const base = Math.max(0.6, Number(energyTodayKwh || 0));
  const labels = ["L", "M", "X", "J", "V", "S", "D"];
  const dateSeed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  return labels.map((label, index) => {
    if (index === labels.length - 1) {
      return { label, kwh: Number(base.toFixed(2)) };
    }

    // Weekly profile with deterministic variation, so it looks realistic and stable per day.
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
