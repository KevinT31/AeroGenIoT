import { AlertApiItem, AlertItem, LatestReadingApi, TelemetryReading } from "../../types/aerogen";

const toNullableNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDirection = (value: unknown) => {
  const parsed = toNullableNumber(value);
  if (parsed === null) return null;
  return ((parsed % 360) + 360) % 360;
};

const firstNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = toNullableNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const whToKwh = (value: unknown) => {
  const parsed = toNullableNumber(value);
  return parsed === null ? null : parsed / 1000;
};

const deriveSourceNow = (windSpeedMs: number | null, batteryPowerW: number | null, loadPowerW: number | null) => {
  if (batteryPowerW === null && windSpeedMs === null) return null;
  if ((batteryPowerW ?? 0) > 60 || (windSpeedMs ?? 0) < 3) return "BATTERY" as const;
  if ((batteryPowerW ?? 0) < -60 && (loadPowerW ?? 0) > 0) return "WIND" as const;
  return "BOTH" as const;
};

const communityAlertType = (type: string) => {
  const normalized = String(type || "").trim().toLowerCase();

  if (["battery_low", "soc_low", "battery_soc_low"].includes(normalized)) return "battery_low";
  if (["battery_critical", "soc_critical", "battery_soc_critical"].includes(normalized)) return "battery_critical";
  if (["battery_overtemperature", "battery_temp_high", "controller_overtemperature", "battery_alert_overtemp"].includes(normalized)) {
    return "battery_overtemperature";
  }
  if (["system_overload", "controller_overload", "inverter_overload", "battery_alert_overload", "inverter_alert_overload"].includes(normalized)) {
    return "system_overload";
  }
  if (["supply_cut", "power_cut", "output_cut", "corte_suministro", "inverter_alert_supply_cut"].includes(normalized)) {
    return "supply_cut";
  }
  if (["inverter_fault", "fault", "inverter_failure", "inverter_alert_fault"].includes(normalized)) return "inverter_fault";
  if (["low_wind", "wind_low"].includes(normalized)) return "low_wind";
  if (["high_wind", "wind_high", "wind_danger"].includes(normalized)) return "high_wind";
  if (["rotor_rpm_high", "rpm_high", "rotor_rpm_out_of_range"].includes(normalized)) return "rotor_rpm_high";
  if (["vibration_high", "vibration_critical"].includes(normalized)) return "vibration_high";
  if (["inverter_temp_high", "generator_temp_high"].includes(normalized)) return "inverter_temp_high";
  return null;
};

const alertSeverity = (canonicalType: string, rawType: string, rawSeverity?: string | null) => {
  const normalizedSeverity = String(rawSeverity || "").trim().toLowerCase();

  if (["critical", "stop", "error"].includes(normalizedSeverity)) return "stop" as const;
  if (["warning", "warn"].includes(normalizedSeverity)) return "warn" as const;
  if (normalizedSeverity === "ok") return "ok" as const;

  if (["battery_critical", "battery_overtemperature", "supply_cut", "inverter_fault", "rotor_rpm_high"].includes(canonicalType)) {
    return "stop" as const;
  }

  if (rawType === "vibration_critical") return "stop" as const;
  return "warn" as const;
};

export const normalizeReading = (raw: LatestReadingApi | null): TelemetryReading | null => {
  if (!raw || !raw.id || !raw.deviceId) return null;

  return {
    id: raw.id,
    deviceId: String(raw.deviceId),
    farmId: raw.farmId ?? null,
    plotId: raw.plotId ?? null,
    ts: raw.ts ?? null,
    windSpeedMs: firstNumber(raw.wind_speed_mps, raw.windSpeedMs),
    windDirectionDeg: normalizeDirection(raw.wind_dir_deg ?? raw.windDirectionDeg ?? raw.windDirDeg ?? raw.windDirection),
    genVoltageV: firstNumber(raw.battery_voltage_dc_v, raw.batteryVoltageDcV, raw.batteryDcVoltageV, raw.batteryVoltageV, raw.genVoltageV),
    genCurrentA: firstNumber(raw.battery_current_dc_a, raw.batteryCurrentDcA, raw.batteryDcCurrentA, raw.batteryCurrentA, raw.genCurrentA),
    powerW: firstNumber(raw.battery_power_w, raw.batteryPowerW, raw.batteryChargeDischargePowerW, raw.powerW),
    loadPowerW: firstNumber(raw.house_power_consumption_w, raw.housePowerW, raw.consumedPowerW, raw.loadPowerW),
    outputVoltageAcV: firstNumber(raw.inverter_output_voltage_ac_v, raw.outputVoltageAcV, raw.acOutputVoltageV, raw.inverterOutputVoltageV),
    outputCurrentAcA: firstNumber(raw.inverter_output_current_ac_a, raw.outputCurrentAcA, raw.acOutputCurrentA, raw.inverterOutputCurrentA),
    sourceNow:
      raw.sourceNow ??
      deriveSourceNow(
        firstNumber(raw.wind_speed_mps, raw.windSpeedMs),
        firstNumber(raw.battery_power_w, raw.batteryPowerW, raw.batteryChargeDischargePowerW, raw.powerW),
        firstNumber(raw.house_power_consumption_w, raw.housePowerW, raw.consumedPowerW, raw.loadPowerW),
      ),
    sourceReason: raw.sourceReason ?? null,
    vibrationRms: firstNumber(raw.motor_vibration, raw.motorVibrationRms, raw.vibrationRms),
    vibrationSignal: firstNumber(raw.vibration_signal, raw.vibrationSignal, raw.vibrationSensorSignal),
    genTempC: firstNumber(raw.inverter_temp_c, raw.inverterTempC, raw.inverterTemperatureC, raw.genTempC),
    rotorRpm: firstNumber(raw.blade_rpm, raw.rotorRpm, raw.rpm),
    batteryPct: firstNumber(raw.battery_soc_pct, raw.stateOfChargePct, raw.batterySocPct, raw.batteryPct),
    estimatedAutonomyHours: firstNumber(raw.battery_autonomy_estimated_h, raw.estimatedAutonomyHours, raw.autonomyHours, raw.batteryAutonomyHours),
    energyTodayKwh: firstNumber(raw.energyTodayKwh, raw.deliveredEnergyKwh, raw.energyDeliveredKwh, whToKwh(raw.energy_delivered_wh)),
    mode: raw.mode ?? null,
    createdAt: raw.createdAt ?? null,
  };
};

export const normalizeAlert = (raw: AlertApiItem): AlertItem | null => {
  const rawType = String(raw.type || "");
  const type = communityAlertType(rawType);
  if (!type) return null;

  return {
    id: String(raw.id),
    deviceId: raw.deviceId ?? null,
    farmId: raw.farmId ?? null,
    plotId: raw.plotId ?? null,
    type,
    rawType,
    status: raw.status,
    message: String(raw.message || ""),
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
    severity: alertSeverity(type, rawType, raw.severity),
  };
};

export const normalizeAlerts = (rawAlerts: AlertApiItem[]) =>
  rawAlerts
    .map(normalizeAlert)
    .filter((item): item is AlertItem => Boolean(item));
