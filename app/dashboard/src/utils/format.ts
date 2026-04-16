import {
  AlarmSeverity,
  ComponentState,
  ConnectivityStatus,
  SourceNow,
  TelemetryPoint,
} from "@/types/dashboard";
import {
  DashboardLanguage,
  dashboardLocale,
  translateDashboard,
} from "@/i18n/translations";
import { OverallStatus } from "@/types/dashboard";

export const formatNumber = (value: number | null | undefined, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return Number(value).toFixed(digits);
};

export const formatCompactTime = (
  timestamp: string | null | undefined,
  language: DashboardLanguage = "en",
) => {
  if (!timestamp) return "--";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString(dashboardLocale(language), {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDateTime = (
  timestamp: string | null | undefined,
  language: DashboardLanguage = "en",
) => {
  if (!timestamp) return "--";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString(dashboardLocale(language));
};

export const timeAgo = (
  timestamp: string | null | undefined,
  language: DashboardLanguage = "en",
) => {
  if (!timestamp) return translateDashboard(language, "common.noData");
  const date = new Date(timestamp).getTime();
  if (!Number.isFinite(date)) return translateDashboard(language, "common.noData");
  const delta = Math.max(0, Date.now() - date);
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return translateDashboard(language, "common.secondsAgo");
  if (minutes < 60) {
    return translateDashboard(language, "common.minutesAgo", { value: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return translateDashboard(language, "common.hoursAgo", { value: hours });
  }
  const days = Math.floor(hours / 24);
  return translateDashboard(language, "common.daysAgo", { value: days });
};

export const sourceLabel = (
  source: SourceNow | null | undefined,
  language: DashboardLanguage = "en",
) => {
  if (source === "WIND") return translateDashboard(language, "source.wind");
  if (source === "BATTERY") return translateDashboard(language, "source.battery");
  if (source === "BOTH") return translateDashboard(language, "source.hybrid");
  return translateDashboard(language, "source.unknown");
};

export const sourceNarrative = (
  reading: TelemetryPoint | null,
  language: DashboardLanguage = "en",
) => {
  if (!reading?.sourceNow) {
    return translateDashboard(language, "source.waiting");
  }
  if (reading.sourceNow === "WIND") {
    return translateDashboard(language, "source.narrative.wind");
  }
  if (reading.sourceNow === "BATTERY") {
    return translateDashboard(language, "source.narrative.battery");
  }
  return translateDashboard(language, "source.narrative.hybrid");
};

export const severityColor = (severity: AlarmSeverity) => {
  if (severity === "critical") return "text-signal-danger";
  if (severity === "warning") return "text-signal-warn";
  return "text-signal-info";
};

export const connectivityLabel = (
  status: ConnectivityStatus,
  language: DashboardLanguage = "en",
) => {
  if (status === "live") return translateDashboard(language, "connectivity.live");
  if (status === "stale") return translateDashboard(language, "connectivity.stale");
  if (status === "offline") return translateDashboard(language, "connectivity.offline");
  if (status === "empty") return translateDashboard(language, "connectivity.empty");
  return translateDashboard(language, "connectivity.error");
};

export const overallStatusLabel = (
  status: OverallStatus,
  language: DashboardLanguage = "en",
) => {
  if (status === "nominal") return translateDashboard(language, "health.status.nominal");
  if (status === "attention") return translateDashboard(language, "health.status.attention");
  if (status === "critical") return translateDashboard(language, "health.status.critical");
  return translateDashboard(language, "health.status.offline");
};

export const componentBadgeTone = (status: ComponentState) => {
  if (status === "critical") return "critical";
  if (status === "warning") return "warning";
  if (status === "offline") return "offline";
  return "normal";
};

export const summarizeWindow = (points: TelemetryPoint[]) => {
  if (!points.length) {
    return {
      avgWind: null,
      avgBatteryPower: null,
      avgHousePower: null,
      avgBatterySoc: null,
      peakTemp: null,
      peakVibration: null,
      peakRpm: null,
    };
  }

  const numeric = (selector: (point: TelemetryPoint) => number | null) =>
    points.map(selector).filter((value): value is number => value !== null && Number.isFinite(value));

  const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
  const maximum = (values: number[]) => (values.length ? Math.max(...values) : null);

  return {
    avgWind: average(numeric((point) => point.windSpeedMs)),
    avgBatteryPower: average(numeric((point) => point.powerW)),
    avgHousePower: average(numeric((point) => point.loadPowerW)),
    avgBatterySoc: average(numeric((point) => point.batteryPct)),
    peakTemp: maximum(numeric((point) => point.genTempC)),
    peakVibration: maximum(numeric((point) => point.vibrationRms)),
    peakRpm: maximum(numeric((point) => point.rotorRpm)),
  };
};
