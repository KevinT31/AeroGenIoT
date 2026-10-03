import { AlarmItem, ComponentState, DashboardSnapshot, TelemetryPoint } from "@/types/dashboard";

export type TwinPartId =
  | "rotor"
  | "nacelle"
  | "tower"
  | "vane"
  | "controller"
  | "battery"
  | "inverter"
  | "house";

export const STATE_COLORS: Record<ComponentState, string> = {
  normal: "#2bd47a",
  warning: "#f4b655",
  critical: "#ff6678",
  offline: "#7a8496",
};

export interface TwinSceneModel {
  /** Rotor angular speed in rad/s (already visually scaled). */
  rotorSpeed: number;
  /** Nacelle yaw in radians (wind direction). */
  yawRad: number;
  windSpeedMs: number;
  windDirectionDeg: number | null;
  /** 0..1 — intensity of wind streak animation. */
  windLevel: number;
  /** 0..1 — energy flow turbine -> controller -> battery/inverter. */
  generationFlow: number;
  /** -1..1 — battery flow: >0 charging, <0 discharging. */
  batteryFlow: number;
  /** 0..1 — inverter -> house flow. */
  houseFlow: number;
  housePowered: boolean;
  houseFlicker: boolean;
  batterySoc: number; // 0..1
  partStates: Record<TwinPartId, ComponentState>;
  overall: ComponentState;
  isLive: boolean;
}

const openTypes = (alarms: AlarmItem[]) =>
  new Set(alarms.filter((alarm) => alarm.status === "open").map((alarm) => alarm.type));

const worst = (...states: ComponentState[]): ComponentState => {
  if (states.includes("critical")) return "critical";
  if (states.includes("warning")) return "warning";
  if (states.includes("offline")) return "offline";
  return "normal";
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const buildTwinSceneModel = (snapshot: DashboardSnapshot): TwinSceneModel => {
  const { twin, latest, alarms, health } = snapshot;
  const open = openTypes(alarms);
  const isLive = health.connectivityStatus === "live" || health.connectivityStatus === "stale";

  const windSpeedMs = latest?.windSpeedMs ?? 0;
  const rotorRpm = latest?.rotorRpm ?? null;

  // Visual rotor speed: prefer real RPM, fall back to wind speed; cap so blades stay readable.
  let rotorSpeed = 0;
  if (isLive) {
    if (rotorRpm !== null && rotorRpm > 0) {
      rotorSpeed = clamp01(rotorRpm / 500) * 4.2;
    } else if (windSpeedMs > 0.5) {
      rotorSpeed = clamp01(windSpeedMs / 18) * 3.4;
    }
    if (open.has("rotor_rpm_out_of_range") || open.has("high_wind")) rotorSpeed = Math.max(rotorSpeed, 5.2);
    if (open.has("low_wind")) rotorSpeed = Math.min(rotorSpeed, 0.45);
  }

  const windDirectionDeg = twin.windDirectionDeg ?? latest?.windDirectionDeg ?? null;
  // +180° so the rotor faces the same way as the house (it tracks wind around this baseline).
  const yawRad = (((windDirectionDeg ?? 0) % 360) * Math.PI) / 180 + Math.PI;

  // powerW maps to battery_power_w: >0 the battery is delivering, <0 it is charging.
  const batteryPowerW = latest?.powerW ?? 0;
  const generationFlow = isLive ? clamp01(twin.powerFlowLevel * 0.6 + clamp01(windSpeedMs / 14) * 0.6) : 0;
  const batteryFlow = isLive ? Math.max(-1, Math.min(1, batteryPowerW / 900)) : 0;

  const outputV = latest?.outputVoltageAcV ?? null;
  const housePowered = isLive && outputV !== null && outputV > 50 && !open.has("supply_cut");
  const houseFlow = housePowered ? clamp01((latest?.loadPowerW ?? 0) / 1500 + 0.25) : 0;

  const batteryState = worst(
    twin.batteryStatus,
    open.has("battery_critical") || open.has("soc_critical") ? "critical" : "normal",
    open.has("battery_low") || open.has("soc_low") || open.has("battery_overtemperature") ? "warning" : "normal",
  );
  const rotorState = worst(
    twin.rotorStatus,
    open.has("vibration_critical") ? "critical" : "normal",
    open.has("vibration_high") || open.has("rotor_rpm_out_of_range") || open.has("high_wind") ? "warning" : "normal",
  );
  const inverterState = worst(
    twin.electricalStatus,
    open.has("inverter_fault") || open.has("supply_cut") ? "critical" : "normal",
    open.has("inverter_overload") || open.has("inverter_temp_high") || open.has("ac_voltage_low") || open.has("ac_voltage_high")
      ? "warning"
      : "normal",
  );

  const partStates: Record<TwinPartId, ComponentState> = {
    rotor: rotorState,
    nacelle: worst(twin.generatorStatus, twin.temperatureStatus),
    tower: twin.towerStatus,
    vane: twin.windDirectionStatus,
    controller: worst(twin.electricalStatus, open.has("controller_overload") ? "warning" : "normal"),
    battery: batteryState,
    inverter: inverterState,
    house: worst(
      open.has("house_power_high") ? "warning" : "normal",
      housePowered || !isLive ? "normal" : "warning",
    ),
  };

  return {
    rotorSpeed,
    yawRad,
    windSpeedMs,
    windDirectionDeg,
    windLevel: isLive ? clamp01(windSpeedMs / 16) : 0,
    generationFlow,
    batteryFlow,
    houseFlow,
    housePowered,
    houseFlicker: open.has("supply_cut") || open.has("ac_voltage_low"),
    batterySoc: clamp01((latest?.batteryPct ?? 0) / 100),
    partStates,
    overall:
      health.overallStatus === "critical"
        ? "critical"
        : health.overallStatus === "attention"
          ? "warning"
          : health.overallStatus === "offline"
            ? "offline"
            : "normal",
    isLive,
  };
};

export const partMetricKeys: Record<TwinPartId, (keyof TelemetryPoint)[]> = {
  rotor: ["rotorRpm", "windSpeedMs", "vibrationRms"],
  nacelle: ["genVoltageV", "genCurrentA", "genTempC"],
  tower: ["vibrationRms"],
  vane: ["windDirectionDeg", "windSpeedMs"],
  controller: ["genVoltageV", "genCurrentA", "sourceNow"],
  battery: ["batteryPct", "estimatedAutonomyHours"],
  inverter: ["outputVoltageAcV", "outputCurrentAcA", "genTempC"],
  house: ["loadPowerW", "energyTodayKwh"],
};
