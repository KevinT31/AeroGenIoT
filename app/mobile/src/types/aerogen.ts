export type SourceNow = "WIND" | "BATTERY" | "BOTH";
export type SystemLevel = "ok" | "warn" | "stop";
export type SyncState = "live" | "stale" | "offline" | "empty" | "error";
export type DataMode = "live" | "mock";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export type AiSeverity = "info" | "warning" | "critical";

export interface LatestReadingApi {
  id: string;
  deviceId: string;
  farmId?: string | null;
  plotId?: string | null;
  ts?: string | null;
  stateOfChargePct?: number | null;
  batterySocPct?: number | null;
  battery_soc_pct?: number | null;
  windSpeedMs?: number | null;
  wind_speed_mps?: number | null;
  windDirectionDeg?: number | null;
  windDirDeg?: number | null;
  windDirection?: number | null;
  wind_dir_deg?: number | null;
  batteryVoltageDcV?: number | null;
  batteryDcVoltageV?: number | null;
  batteryVoltageV?: number | null;
  battery_voltage_dc_v?: number | null;
  genVoltageV?: number | null;
  batteryCurrentDcA?: number | null;
  batteryDcCurrentA?: number | null;
  batteryCurrentA?: number | null;
  battery_current_dc_a?: number | null;
  genCurrentA?: number | null;
  batteryPowerW?: number | null;
  batteryChargeDischargePowerW?: number | null;
  battery_power_w?: number | null;
  powerW?: number | null;
  housePowerW?: number | null;
  consumedPowerW?: number | null;
  house_power_consumption_w?: number | null;
  loadPowerW?: number | null;
  outputVoltageAcV?: number | null;
  acOutputVoltageV?: number | null;
  inverterOutputVoltageV?: number | null;
  inverter_output_voltage_ac_v?: number | null;
  outputCurrentAcA?: number | null;
  acOutputCurrentA?: number | null;
  inverterOutputCurrentA?: number | null;
  inverter_output_current_ac_a?: number | null;
  sourceNow?: SourceNow | null;
  sourceReason?: string | null;
  motorVibrationRms?: number | null;
  motor_vibration?: number | null;
  vibrationRms?: number | null;
  vibrationSignal?: number | null;
  vibrationSensorSignal?: number | null;
  vibration_signal?: number | null;
  inverterTempC?: number | null;
  inverterTemperatureC?: number | null;
  inverter_temp_c?: number | null;
  genTempC?: number | null;
  rotorRpm?: number | null;
  rpm?: number | null;
  blade_rpm?: number | null;
  batteryPct?: number | null;
  estimatedAutonomyHours?: number | null;
  autonomyHours?: number | null;
  batteryAutonomyHours?: number | null;
  battery_autonomy_estimated_h?: number | null;
  energy_delivered_wh?: number | null;
  deliveredEnergyKwh?: number | null;
  energyDeliveredKwh?: number | null;
  energyTodayKwh?: number | null;
  battery_alert_low?: boolean | null;
  battery_alert_overload?: boolean | null;
  battery_alert_overtemp?: boolean | null;
  inverter_alert_overload?: boolean | null;
  inverter_alert_fault?: boolean | null;
  inverter_alert_supply_cut?: boolean | null;
  mode?: string | null;
  createdAt?: string | null;
}

export interface AlertApiItem {
  id: string;
  deviceId?: string | null;
  farmId?: string | null;
  plotId?: string | null;
  type: string;
  status: AlertStatus;
  message: string;
  createdAt: string;
  updatedAt: string;
  severity?: string | null;
}

export interface FaultPrediction {
  deviceId: string | null;
  label: string | null;
  confidencePct: number | null;
  severity: AiSeverity;
  recommendedAction: string | null;
  timestamp: string | null;
}

export interface PowerForecast {
  deviceId: string | null;
  predictedPowerW: number | null;
  lowerBoundW: number | null;
  upperBoundW: number | null;
  horizonMinutes: number | null;
  timestamp: string | null;
}

export interface YawRecommendation {
  deviceId: string | null;
  targetYawDeg: number | null;
  action: string | null;
  confidencePct: number | null;
  reason: string | null;
  timestamp: string | null;
}

export interface OperationalAiSnapshot {
  deviceId: string | null;
  updatedAt: string | null;
  faultPrediction: FaultPrediction | null;
  powerForecast: PowerForecast | null;
  yawRecommendation: YawRecommendation | null;
}

export interface TelemetryReading {
  id: string;
  deviceId: string;
  farmId: string | null;
  plotId: string | null;
  ts: string | null;
  windSpeedMs: number | null;
  windDirectionDeg: number | null;
  genVoltageV: number | null;
  genCurrentA: number | null;
  powerW: number | null;
  loadPowerW: number | null;
  outputVoltageAcV: number | null;
  outputCurrentAcA: number | null;
  sourceNow: SourceNow | null;
  sourceReason: string | null;
  vibrationRms: number | null;
  vibrationSignal: number | null;
  genTempC: number | null;
  rotorRpm: number | null;
  batteryPct: number | null;
  estimatedAutonomyHours: number | null;
  energyTodayKwh: number | null;
  mode: string | null;
  createdAt: string | null;
}

export interface AlertItem {
  id: string;
  deviceId: string | null;
  farmId: string | null;
  plotId: string | null;
  type: string;
  rawType: string;
  status: AlertStatus;
  message: string;
  createdAt: string;
  updatedAt: string;
  severity: SystemLevel;
}

export interface SupportContact {
  phone: string;
  displayPhone: string;
}
