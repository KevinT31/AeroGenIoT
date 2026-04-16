export type ConnectivityStatus = "live" | "stale" | "offline" | "empty" | "error";
export type ComponentState = "normal" | "warning" | "critical" | "offline";
export type OverallStatus = "nominal" | "attention" | "critical" | "offline";
export type AlarmSeverity = "info" | "warning" | "critical";
export type AlarmStatus = "open" | "acknowledged" | "resolved";
export type MaintenanceCategory = "corrective" | "preventive" | "predictive";
export type MaintenancePriority = "low" | "medium" | "high" | "critical";
export type MaintenanceStatus = "new" | "scheduled" | "in_progress" | "resolved";
export type TimeRange = "1h" | "6h" | "24h" | "7d";
export type SourceNow = "WIND" | "BATTERY" | "BOTH";
export type AiSeverity = "info" | "warning" | "critical";

export interface TelemetryPoint {
  timestamp: string;
  windSpeedMs: number | null;
  windDirectionDeg: number | null;
  genVoltageV: number | null;
  genCurrentA: number | null;
  outputVoltageAcV: number | null;
  outputCurrentAcA: number | null;
  vibrationRms: number | null;
  vibrationSignal: number | null;
  genTempC: number | null;
  rotorRpm: number | null;
  batteryPct: number | null;
  estimatedAutonomyHours: number | null;
  loadPowerW: number | null;
  powerW: number | null;
  energyTodayKwh: number | null;
  sourceNow: SourceNow | null;
  sourceReason: string | null;
  mode: string | null;
}

export interface SystemHealthSnapshot {
  deviceId: string;
  timestamp: string | null;
  connectivityStatus: ConnectivityStatus;
  overallStatus: OverallStatus;
  healthScore: number;
  activeAlertsCount: number;
  maintenanceStatus: string;
  generationStatus: string;
  batteryStatus: string;
  recommendedAction: string;
}

export interface AlarmItem {
  id: string;
  type: string;
  rawType: string;
  severity: AlarmSeverity;
  title: string;
  description: string;
  timestamp: string;
  status: AlarmStatus;
  deviceId: string | null;
  suggestedAction: string;
}

export interface MaintenanceItem {
  id: string;
  category: MaintenanceCategory;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  component: string;
  sourceRule: string;
  createdAt: string;
  dueDate: string;
  recommendedAction: string;
}

export interface DigitalTwinState {
  rotorStatus: ComponentState;
  generatorStatus: ComponentState;
  towerStatus: ComponentState;
  electricalStatus: ComponentState;
  batteryStatus: ComponentState;
  sensorsStatus: ComponentState;
  connectivityStatus: ComponentState;
  windDirectionDeg: number | null;
  windDirectionStatus: ComponentState;
  temperatureStatus: ComponentState;
  vibrationStatus: ComponentState;
  voltageStatus: ComponentState;
  powerFlowLevel: number;
  animationLevel: number;
  highlights: string[];
  warnings: string[];
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

export interface AiOperationalSnapshot {
  deviceId: string | null;
  updatedAt: string | null;
  faultPrediction: FaultPrediction | null;
  powerForecast: PowerForecast | null;
  yawRecommendation: YawRecommendation | null;
}

export interface DashboardSnapshot {
  latest: TelemetryPoint | null;
  history: TelemetryPoint[];
  alarms: AlarmItem[];
  maintenance: MaintenanceItem[];
  ai: AiOperationalSnapshot | null;
  health: SystemHealthSnapshot;
  twin: DigitalTwinState;
  lastUpdatedAt: string | null;
}

export interface ApiLatestReading {
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
  vaneAngleDeg?: number | null;
  as5600AngleDeg?: number | null;
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
  outputVoltageAcV?: number | null;
  acOutputVoltageV?: number | null;
  inverterOutputVoltageV?: number | null;
  inverter_output_voltage_ac_v?: number | null;
  outputCurrentAcA?: number | null;
  acOutputCurrentA?: number | null;
  inverterOutputCurrentA?: number | null;
  inverter_output_current_ac_a?: number | null;
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
  housePowerW?: number | null;
  consumedPowerW?: number | null;
  house_power_consumption_w?: number | null;
  loadPowerW?: number | null;
  batteryPowerW?: number | null;
  batteryChargeDischargePowerW?: number | null;
  battery_power_w?: number | null;
  powerW?: number | null;
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
  sourceNow?: SourceNow | null;
  sourceReason?: string | null;
  mode?: string | null;
  createdAt?: string | null;
}

export interface ApiAlertItem {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  status: AlarmStatus;
  deviceId?: string | null;
  severity?: string | null;
}
