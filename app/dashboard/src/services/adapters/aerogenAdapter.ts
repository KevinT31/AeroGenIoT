import { AlarmItem, ApiAlertItem, ApiLatestReading, TelemetryPoint } from "@/types/dashboard";
import {
  DashboardLanguage,
  translateDashboard,
} from "@/i18n/translations";

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDirection = (value: unknown) => {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  return ((parsed % 360) + 360) % 360;
};

const firstNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const whToKwh = (value: unknown) => {
  const parsed = toNumber(value);
  return parsed === null ? null : parsed / 1000;
};

const deriveSourceNow = (windSpeedMs: number | null, batteryPowerW: number | null, housePowerW: number | null) => {
  if (batteryPowerW === null && windSpeedMs === null) return null;
  if ((batteryPowerW ?? 0) > 60 || (windSpeedMs ?? 0) < 3) return "BATTERY" as const;
  if ((batteryPowerW ?? 0) < -60 && (housePowerW ?? 0) > 0) return "WIND" as const;
  return "BOTH" as const;
};

const canonicalAlarmType = (type: string) => {
  const normalized = String(type || "").trim().toLowerCase();

  if (["battery_low", "soc_low", "battery_soc_low", "battery_alert_low"].includes(normalized)) return "soc_low";
  if (["battery_critical", "soc_critical", "battery_soc_critical"].includes(normalized)) return "soc_critical";
  if (["battery_voltage_low", "dc_voltage_low"].includes(normalized)) return "battery_voltage_low";
  if (["battery_voltage_high", "dc_voltage_high"].includes(normalized)) return "battery_voltage_high";
  if (["battery_discharge_current_high", "dc_discharge_current_high"].includes(normalized)) {
    return "battery_discharge_current_high";
  }
  if (["battery_charge_current_high", "dc_charge_current_high"].includes(normalized)) {
    return "battery_charge_current_high";
  }
  if (["battery_overtemperature", "battery_temp_high", "controller_overtemperature", "battery_alert_overtemp"].includes(normalized)) {
    return "battery_overtemperature";
  }
  if (["controller_overload", "battery_alert_overload"].includes(normalized)) return "controller_overload";
  if (["ac_voltage_low", "output_voltage_low"].includes(normalized)) return "ac_voltage_low";
  if (["ac_voltage_high", "output_voltage_high"].includes(normalized)) return "ac_voltage_high";
  if (["ac_current_high", "output_current_high"].includes(normalized)) return "ac_current_high";
  if (["house_power_high", "load_power_high", "consumption_high"].includes(normalized)) return "house_power_high";
  if (["system_overload", "inverter_overload", "inverter_alert_overload"].includes(normalized)) return "inverter_overload";
  if (["inverter_fault", "fault", "inverter_failure", "inverter_alert_fault"].includes(normalized)) return "inverter_fault";
  if (["supply_cut", "power_cut", "output_cut", "corte_suministro", "inverter_alert_supply_cut"].includes(normalized)) return "supply_cut";
  if (["inverter_temp_high", "generator_temp_high"].includes(normalized)) return "inverter_temp_high";
  if (["low_wind", "wind_low"].includes(normalized)) return "low_wind";
  if (["high_wind", "wind_high", "wind_danger"].includes(normalized)) return "high_wind";
  if (["vibration_high"].includes(normalized)) return "vibration_high";
  if (["vibration_critical"].includes(normalized)) return "vibration_critical";
  if (["rotor_rpm_high", "rpm_high", "rotor_rpm_out_of_range"].includes(normalized)) {
    return "rotor_rpm_out_of_range";
  }

  return normalized || "unknown_alarm";
};

export const normalizeLatestReading = (raw: ApiLatestReading | null): TelemetryPoint | null => {
  if (!raw || !raw.deviceId) return null;

  return {
    timestamp: raw.ts || raw.createdAt || new Date().toISOString(),
    windSpeedMs: firstNumber(raw.wind_speed_mps, raw.windSpeedMs),
    windDirectionDeg: normalizeDirection(
      raw.wind_dir_deg ??
      raw.windDirectionDeg ??
        raw.windDirDeg ??
        raw.windDirection ??
        raw.vaneAngleDeg ??
        raw.as5600AngleDeg,
    ),
    genVoltageV: firstNumber(raw.battery_voltage_dc_v, raw.batteryVoltageDcV, raw.batteryDcVoltageV, raw.batteryVoltageV, raw.genVoltageV),
    genCurrentA: firstNumber(raw.battery_current_dc_a, raw.batteryCurrentDcA, raw.batteryDcCurrentA, raw.batteryCurrentA, raw.genCurrentA),
    outputVoltageAcV: firstNumber(raw.inverter_output_voltage_ac_v, raw.outputVoltageAcV, raw.acOutputVoltageV, raw.inverterOutputVoltageV),
    outputCurrentAcA: firstNumber(raw.inverter_output_current_ac_a, raw.outputCurrentAcA, raw.acOutputCurrentA, raw.inverterOutputCurrentA),
    vibrationRms: firstNumber(raw.motor_vibration, raw.motorVibrationRms, raw.vibrationRms),
    vibrationSignal: firstNumber(raw.vibration_signal, raw.vibrationSignal, raw.vibrationSensorSignal),
    genTempC: firstNumber(raw.inverter_temp_c, raw.inverterTempC, raw.inverterTemperatureC, raw.genTempC),
    rotorRpm: firstNumber(raw.blade_rpm, raw.rotorRpm, raw.rpm),
    batteryPct: firstNumber(raw.battery_soc_pct, raw.stateOfChargePct, raw.batterySocPct, raw.batteryPct),
    estimatedAutonomyHours: firstNumber(raw.battery_autonomy_estimated_h, raw.estimatedAutonomyHours, raw.autonomyHours, raw.batteryAutonomyHours),
    loadPowerW: firstNumber(raw.house_power_consumption_w, raw.housePowerW, raw.consumedPowerW, raw.loadPowerW),
    powerW: firstNumber(raw.battery_power_w, raw.batteryPowerW, raw.batteryChargeDischargePowerW, raw.powerW),
    energyTodayKwh: firstNumber(raw.energyTodayKwh, raw.deliveredEnergyKwh, raw.energyDeliveredKwh, whToKwh(raw.energy_delivered_wh)),
    sourceNow:
      raw.sourceNow ??
      deriveSourceNow(
        firstNumber(raw.wind_speed_mps, raw.windSpeedMs),
        firstNumber(raw.battery_power_w, raw.batteryPowerW, raw.batteryChargeDischargePowerW, raw.powerW),
        firstNumber(raw.house_power_consumption_w, raw.housePowerW, raw.consumedPowerW, raw.loadPowerW),
      ),
    sourceReason: raw.sourceReason ?? null,
    mode: raw.mode ?? null,
  };
};

export const normalizeHistoryPoint = (raw: Record<string, unknown>): TelemetryPoint | null => {
  const timestamp = String(raw.timestamp || raw.ts || raw.createdAt || "");
  if (!timestamp) return null;

  return {
    timestamp,
    windSpeedMs: firstNumber(raw.wind_speed_mps, raw.windSpeedMs ?? raw.windSpeed),
    windDirectionDeg: normalizeDirection(
      raw.wind_dir_deg ??
      raw.windDirectionDeg ??
        raw.windDirDeg ??
        raw.windDirection ??
        raw.vaneAngleDeg ??
        raw.as5600AngleDeg ??
        raw.windAngleDeg,
    ),
    genVoltageV: firstNumber(raw.battery_voltage_dc_v, raw.batteryVoltageDcV, raw.batteryDcVoltageV, raw.batteryVoltageV, raw.genVoltageV),
    genCurrentA: firstNumber(raw.battery_current_dc_a, raw.batteryCurrentDcA, raw.batteryDcCurrentA, raw.batteryCurrentA, raw.genCurrentA),
    outputVoltageAcV: firstNumber(raw.inverter_output_voltage_ac_v, raw.outputVoltageAcV, raw.acOutputVoltageV, raw.inverterOutputVoltageV),
    outputCurrentAcA: firstNumber(raw.inverter_output_current_ac_a, raw.outputCurrentAcA, raw.acOutputCurrentA, raw.inverterOutputCurrentA),
    vibrationRms: firstNumber(raw.motor_vibration, raw.motorVibrationRms, raw.vibrationRms),
    vibrationSignal: firstNumber(raw.vibration_signal, raw.vibrationSignal, raw.vibrationSensorSignal),
    genTempC: firstNumber(raw.inverter_temp_c, raw.inverterTempC, raw.inverterTemperatureC, raw.genTempC),
    rotorRpm: firstNumber(raw.blade_rpm, raw.rotorRpm, raw.rpm),
    batteryPct: firstNumber(raw.battery_soc_pct, raw.stateOfChargePct, raw.batterySocPct, raw.batteryPct),
    estimatedAutonomyHours: firstNumber(raw.battery_autonomy_estimated_h, raw.estimatedAutonomyHours, raw.autonomyHours, raw.batteryAutonomyHours),
    loadPowerW: firstNumber(raw.house_power_consumption_w, raw.housePowerW, raw.consumedPowerW, raw.loadPowerW),
    powerW: firstNumber(raw.battery_power_w, raw.batteryPowerW, raw.batteryChargeDischargePowerW, raw.powerW),
    energyTodayKwh: firstNumber(raw.energyTodayKwh, raw.deliveredEnergyKwh, raw.energyDeliveredKwh, whToKwh(raw.energy_delivered_wh)),
    sourceNow:
      (raw.sourceNow as TelemetryPoint["sourceNow"]) ??
      deriveSourceNow(
        firstNumber(raw.wind_speed_mps, raw.windSpeedMs ?? raw.windSpeed),
        firstNumber(raw.battery_power_w, raw.batteryPowerW, raw.batteryChargeDischargePowerW, raw.powerW),
        firstNumber(raw.house_power_consumption_w, raw.housePowerW, raw.consumedPowerW, raw.loadPowerW),
      ),
    sourceReason: (raw.sourceReason as string | null) ?? null,
    mode: (raw.ingestMode as string | null) ?? (raw.mode as string | null) ?? null,
  };
};

const alarmSeverity = (type: string): AlarmItem["severity"] => {
  if (
    [
      "soc_critical",
      "battery_overtemperature",
      "controller_overload",
      "inverter_overload",
      "inverter_fault",
      "supply_cut",
      "vibration_critical",
      "rotor_rpm_out_of_range",
    ].includes(type)
  ) {
    return "critical";
  }

  if (type === "unknown_alarm") return "info";
  return "warning";
};

const alarmTitle = (type: string, language: DashboardLanguage) => {
  return translateDashboard(language, `alarm.title.${type}`);
};

const alarmAction = (type: string, language: DashboardLanguage) => {
  return translateDashboard(language, `alarm.action.${type}`);
};

export const normalizeAlarm = (
  raw: ApiAlertItem,
  language: DashboardLanguage = "en",
): AlarmItem => ({
  id: String(raw.id),
  type: canonicalAlarmType(raw.type),
  rawType: String(raw.type || ""),
  severity:
    raw.severity && ["critical", "warning", "info"].includes(String(raw.severity).toLowerCase())
      ? (String(raw.severity).toLowerCase() as AlarmItem["severity"])
      : alarmSeverity(canonicalAlarmType(raw.type)),
  title: alarmTitle(canonicalAlarmType(raw.type), language),
  description: raw.message,
  timestamp: raw.updatedAt || raw.createdAt,
  status: raw.status,
  deviceId: raw.deviceId ?? null,
  suggestedAction: alarmAction(canonicalAlarmType(raw.type), language),
});

export const relocalizeAlarm = (
  alarm: AlarmItem,
  language: DashboardLanguage = "en",
): AlarmItem => ({
  ...alarm,
  title: alarmTitle(alarm.type, language),
  suggestedAction: alarmAction(alarm.type, language),
});
