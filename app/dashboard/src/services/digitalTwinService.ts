import { ConnectivityStatus, DigitalTwinState, TelemetryPoint } from "@/types/dashboard";
import {
  DashboardLanguage,
  translateDashboard,
} from "@/i18n/translations";

const thresholdState = (value: number | null | undefined, warn: number, critical: number) => {
  if (value === null || value === undefined) return "offline" as const;
  if (value >= critical) return "critical" as const;
  if (value >= warn) return "warning" as const;
  return "normal" as const;
};

const rank: Record<DigitalTwinState["rotorStatus"], number> = {
  normal: 0,
  warning: 1,
  critical: 2,
  offline: 3,
};

const maxState = (...states: DigitalTwinState["rotorStatus"][]) =>
  [...states].sort((left, right) => rank[right] - rank[left])[0] ?? "normal";

const voltageState = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "offline" as const;
  if (value < 42 || value > 58) return "critical" as const;
  if (value < 46 || value > 55) return "warning" as const;
  return "normal" as const;
};

const acVoltageState = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "offline" as const;
  if (value < 190 || value > 250) return "critical" as const;
  if (value < 210 || value > 240) return "warning" as const;
  return "normal" as const;
};

export const digitalTwinService = {
  build(
    latest: TelemetryPoint | null,
    connectivity: ConnectivityStatus,
    language: DashboardLanguage = "en",
  ): DigitalTwinState {
    if (!latest || connectivity === "offline" || connectivity === "error") {
      return {
        rotorStatus: "offline",
        generatorStatus: "offline",
        towerStatus: "offline",
        electricalStatus: "offline",
        batteryStatus: "offline",
        sensorsStatus: "offline",
        connectivityStatus: "offline",
        windDirectionDeg: null,
        windDirectionStatus: "offline",
        temperatureStatus: "offline",
        vibrationStatus: "offline",
        voltageStatus: "offline",
        powerFlowLevel: 0,
        animationLevel: 0,
        highlights: [],
        warnings: [translateDashboard(language, "twin.telemetryUnavailable")],
      };
    }

    const vibrationStatus = thresholdState(latest.vibrationRms, 4, 7);
    const rotorStatus = vibrationStatus;
    const temperatureStatus = thresholdState(latest.genTempC, 55, 70);
    const generatorStatus = temperatureStatus;
    const batteryVoltageStatus = voltageState(latest.genVoltageV);
    const outputVoltageStatus = acVoltageState(latest.outputVoltageAcV);
    const powerFlowLevel = Math.max(0, Math.min(1.15, (latest.loadPowerW ?? 0) / 2500));
    const electricalBalanceStatus =
      (latest.loadPowerW ?? 0) > 2000 || outputVoltageStatus !== "normal"
        ? "warning"
        : "normal";
    const electricalStatus = maxState(electricalBalanceStatus, outputVoltageStatus);
    const batteryStatus = (latest.batteryPct ?? 0) < 20 ? "critical" : (latest.batteryPct ?? 0) < 40 ? "warning" : "normal";
    const windDirectionStatus =
      latest.windDirectionDeg === null || latest.windDirectionDeg === undefined
        ? (latest.windSpeedMs ?? 0) > 1
          ? "warning"
          : "normal"
        : "normal";
    const sensorsStatus = maxState(
      connectivity === "stale" ? "warning" : "normal",
      windDirectionStatus,
      latest.vibrationRms === null ? "warning" : "normal",
      latest.genTempC === null ? "warning" : "normal",
      latest.genVoltageV === null ? "warning" : "normal",
      latest.outputVoltageAcV === null ? "warning" : "normal",
    );

    const warnings = [
      generatorStatus !== "normal"
        ? translateDashboard(language, "twin.warn.generator")
        : null,
      rotorStatus !== "normal"
        ? translateDashboard(language, "twin.warn.rotor")
        : null,
      batteryStatus !== "normal"
        ? translateDashboard(language, "twin.warn.battery")
        : null,
      electricalStatus !== "normal"
        ? translateDashboard(language, "twin.warn.electrical")
        : null,
      windDirectionStatus !== "normal"
        ? translateDashboard(language, "twin.warn.windDirection")
        : null,
    ].filter((value): value is string => Boolean(value));

    const highlights = [
      rotorStatus !== "normal" ? "rotor" : null,
      generatorStatus !== "normal" ? "generator" : null,
      electricalStatus !== "normal" ? "electrical" : null,
      batteryStatus !== "normal" ? "battery" : null,
      sensorsStatus !== "normal" || windDirectionStatus !== "normal" ? "sensors" : null,
    ].filter((value): value is string => Boolean(value));

    return {
      rotorStatus,
      generatorStatus,
      towerStatus: vibrationStatus === "critical" ? "warning" : "normal",
      electricalStatus,
      batteryStatus,
      sensorsStatus,
      connectivityStatus: connectivity === "stale" ? "warning" : "normal",
      windDirectionDeg: latest.windDirectionDeg,
      windDirectionStatus,
      temperatureStatus,
      vibrationStatus,
      voltageStatus: maxState(batteryVoltageStatus, outputVoltageStatus),
      powerFlowLevel,
      animationLevel: Math.min(1, Math.max(0.12, (latest.windSpeedMs ?? 0) / 18)),
      highlights,
      warnings,
    };
  },
};
