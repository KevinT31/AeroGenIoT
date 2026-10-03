const DEVICE_ID = "AE-01";
const FARM_ID = "FARM-01";
const PLOT_ID = "PLOT-01";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 1) => Number(value.toFixed(digits));

const buildReading = (indexFromNow = 0) => {
  const timestamp = new Date(Date.now() - indexFromNow * 5 * 60_000);
  const phase = (Date.now() / 60_000 - indexFromNow * 5) / 12;
  const windSpeedMs = round(clamp(8.6 + Math.sin(phase) * 1.9 + Math.cos(phase / 2) * 0.6, 3.5, 15), 2);
  const batterySocPct = round(clamp(72 + Math.sin(phase / 2) * 8 - indexFromNow * 0.08, 42, 92), 1);
  const outputVoltageAcV = round(229 + Math.sin(phase / 3) * 3, 1);
  const outputCurrentAcA = round(clamp(4.8 + Math.cos(phase) * 0.9, 2.6, 7.4), 2);
  const housePowerConsumptionW = round(outputVoltageAcV * outputCurrentAcA, 1);
  const batteryCurrentDcA = round(clamp(7.8 - windSpeedMs * 0.45 + Math.sin(phase) * 0.8, -8, 16), 2);
  const batteryVoltageDcV = round(51.8 + (batterySocPct - 70) * 0.06, 2);
  const batteryPowerW = round(batteryVoltageDcV * batteryCurrentDcA, 1);
  const bladeRpm = round(clamp(windSpeedMs * 58 + Math.sin(phase) * 18, 180, 690), 0);
  const motorVibration = round(clamp(1.2 + windSpeedMs * 0.11 + Math.abs(Math.sin(phase)) * 0.45, 0.8, 3.6), 2);
  const inverterTempC = round(clamp(39 + housePowerConsumptionW / 190 + Math.sin(phase / 2) * 2, 34, 54), 1);

  return {
    id: `mock-${timestamp.getTime()}`,
    deviceId: DEVICE_ID,
    farmId: FARM_ID,
    plotId: PLOT_ID,
    ts: timestamp.toISOString(),
    timestamp: timestamp.toISOString(),
    createdAt: timestamp.toISOString(),
    windSpeedMs,
    wind_speed_mps: windSpeedMs,
    windDirectionDeg: round((142 + Math.sin(phase / 1.7) * 28 + 360) % 360, 0),
    wind_dir_deg: round((142 + Math.sin(phase / 1.7) * 28 + 360) % 360, 0),
    batteryVoltageDcV,
    battery_voltage_dc_v: batteryVoltageDcV,
    batteryCurrentDcA,
    battery_current_dc_a: batteryCurrentDcA,
    batteryPowerW,
    battery_power_w: batteryPowerW,
    batterySocPct,
    battery_soc_pct: batterySocPct,
    stateOfChargePct: batterySocPct,
    batteryAutonomyEstimatedH: round(clamp((batterySocPct / 100) * 5.5, 1.2, 5.5), 1),
    battery_autonomy_estimated_h: round(clamp((batterySocPct / 100) * 5.5, 1.2, 5.5), 1),
    housePowerConsumptionW,
    house_power_consumption_w: housePowerConsumptionW,
    outputVoltageAcV,
    inverter_output_voltage_ac_v: outputVoltageAcV,
    outputCurrentAcA,
    inverter_output_current_ac_a: outputCurrentAcA,
    inverterTempC,
    inverter_temp_c: inverterTempC,
    motorVibration,
    motor_vibration: motorVibration,
    vibrationSignal: round(motorVibration * 740, 0),
    vibration_signal: round(motorVibration * 740, 0),
    rotorRpm: bladeRpm,
    blade_rpm: bladeRpm,
    energyTodayKwh: round(5.8 + Math.max(0, Math.sin(phase / 2)) * 1.7, 2),
    energy_delivered_wh: round((5.8 + Math.max(0, Math.sin(phase / 2)) * 1.7) * 1000, 0),
    battery_alert_low: batterySocPct < 20,
    battery_alert_overload: false,
    battery_alert_overtemp: false,
    inverter_alert_overload: housePowerConsumptionW > 1800,
    inverter_alert_fault: false,
    inverter_alert_supply_cut: outputVoltageAcV < 190,
    sourceNow: batteryCurrentDcA > 2 ? "BATTERY" : batteryCurrentDcA < -2 ? "WIND" : "BOTH",
    sourceReason:
      batteryCurrentDcA > 2
        ? "La vivienda esta usando apoyo de bateria."
        : batteryCurrentDcA < -2
          ? "El viento esta cargando el banco DC."
          : "Generacion y bateria balanceadas.",
    mode: "mock-live",
  };
};

export const mockReadings = (count = 24) => {
  return Array.from({ length: count }, (_, index) => buildReading(count - index - 1));
};

export const mockLatestReading = () => buildReading(0);

export const mockRecommendation = (reading: any) => ({
  id: "mock-rec-1",
  readingId: reading?.id || null,
  cantidadAgua: 0,
  recomendarRiego: false,
  motivo: "Operacion nominal del aerogenerador.",
  createdAt: new Date().toISOString(),
});

export const mockAlerts = () => {
  const latest = buildReading(0);

  return [
    {
      id: "mock-alert-wind-watch",
      type: "low_wind",
      message: `Viento operativo en ${latest.windSpeedMs} m/s; mantener monitoreo de produccion.`,
      severity: "info",
      status: "open",
      deviceId: DEVICE_ID,
      farmId: FARM_ID,
      plotId: PLOT_ID,
      createdAt: new Date(Date.now() - 18 * 60_000).toISOString(),
      updatedAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    },
    {
      id: "mock-alert-maintenance",
      type: "vibration_high",
      message: "Vibracion dentro de rango preventivo; revisar anclajes en la proxima inspeccion.",
      severity: "warning",
      status: "open",
      deviceId: DEVICE_ID,
      farmId: FARM_ID,
      plotId: PLOT_ID,
      createdAt: new Date(Date.now() - 42 * 60_000).toISOString(),
      updatedAt: new Date(Date.now() - 42 * 60_000).toISOString(),
    },
  ];
};
