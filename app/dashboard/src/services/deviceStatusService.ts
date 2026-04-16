import { ENV } from "@/config/env";
import { AlarmItem, ConnectivityStatus, OverallStatus, SystemHealthSnapshot, TelemetryPoint } from "@/types/dashboard";
import {
  DashboardLanguage,
  translateDashboard,
} from "@/i18n/translations";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const deviceStatusService = {
  resolveConnectivity(latest: TelemetryPoint | null, staleAfterMs: number, hasError: boolean): ConnectivityStatus {
    if (hasError && !latest) return "error";
    if (!latest) return "empty";
    const age = Date.now() - new Date(latest.timestamp).getTime();
    if (!Number.isFinite(age)) return "error";
    if (age > staleAfterMs * 2) return "offline";
    if (age > staleAfterMs) return "stale";
    return "live";
  },

  computeHealth(
    latest: TelemetryPoint | null,
    alarms: AlarmItem[],
    connectivityStatus: ConnectivityStatus,
    language: DashboardLanguage = "en",
  ): SystemHealthSnapshot {
    const latestTime = latest?.timestamp ?? null;
    const openAlarms = alarms.filter((alarm) => alarm.status === "open");

    if (!latest) {
      return {
        deviceId: ENV.deviceId,
        timestamp: latestTime,
        connectivityStatus,
        overallStatus: connectivityStatus === "error" ? "offline" : "attention",
        healthScore: 0,
        activeAlertsCount: openAlarms.length,
        maintenanceStatus: translateDashboard(language, "health.awaitingData"),
        generationStatus: translateDashboard(language, "health.noLiveData"),
        batteryStatus: translateDashboard(language, "health.unknownBattery"),
        recommendedAction: translateDashboard(language, "health.restoreDataFlow"),
      };
    }

    let score = 100;
    if ((latest.windSpeedMs ?? 0) > 20) score -= 12;
    if ((latest.genTempC ?? 0) > 70) score -= 18;
    if ((latest.vibrationRms ?? 0) > 7) score -= 18;
    if ((latest.rotorRpm ?? 0) >= 750) score -= 18;
    if ((latest.batteryPct ?? 100) < 20) score -= 18;
    if ((latest.outputVoltageAcV ?? 230) < 210 || (latest.outputVoltageAcV ?? 230) > 240) score -= 10;
    if ((latest.outputVoltageAcV ?? 230) < 190 || (latest.outputVoltageAcV ?? 230) > 250) score -= 16;
    if ((latest.loadPowerW ?? 0) > 2000) score -= 10;
    if (connectivityStatus === "stale") score -= 8;
    if (connectivityStatus === "offline") score -= 24;
    score -= openAlarms.filter((alarm) => alarm.severity === "warning").length * 5;
    score -= openAlarms.filter((alarm) => alarm.severity === "critical").length * 10;

    const healthScore = clamp(Math.round(score), 5, 100);
    const overallStatus: OverallStatus =
      connectivityStatus === "offline" || healthScore < 45
        ? "critical"
        : healthScore < 72 || openAlarms.length
          ? "attention"
          : "nominal";

    return {
      deviceId: ENV.deviceId,
      timestamp: latestTime,
      connectivityStatus,
      overallStatus,
      healthScore,
      activeAlertsCount: openAlarms.length,
      maintenanceStatus:
        overallStatus === "critical"
          ? translateDashboard(language, "health.immediateIntervention")
          : overallStatus === "attention"
            ? translateDashboard(language, "health.plannedIntervention")
            : translateDashboard(language, "health.routineSupervision"),
      generationStatus:
        openAlarms.some((alarm) => alarm.type === "supply_cut")
          ? translateDashboard(language, "health.outputCut")
          : (latest.outputVoltageAcV ?? 0) < 210 || (latest.outputVoltageAcV ?? 0) > 240
            ? translateDashboard(language, "health.outputWatch")
            : translateDashboard(language, "health.outputStable"),
      batteryStatus:
        (latest.batteryPct ?? 0) < 20
          ? translateDashboard(language, "health.reserveLow")
          : (latest.batteryPct ?? 0) < 40
            ? translateDashboard(language, "health.reserveWatch")
            : translateDashboard(language, "health.reserveNormal"),
      recommendedAction:
        overallStatus === "critical"
          ? translateDashboard(language, "health.recommendCritical")
          : overallStatus === "attention"
            ? translateDashboard(language, "health.recommendAttention")
            : translateDashboard(language, "health.recommendNominal"),
    };
  },
};
