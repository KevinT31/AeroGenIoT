import { ENV } from "@/config/env";
import { DashboardLanguage, translateDashboard } from "@/i18n/translations";
import { AlarmItem, TelemetryPoint } from "@/types/dashboard";
import { apiClient } from "./apiClient";
import { normalizeAlarm } from "./adapters/aerogenAdapter";
import { buildMockAlarms } from "./mockData";

const derivedPrefix = "derived:";

const fixed = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined || Number.isNaN(value) ? "--" : Number(value).toFixed(digits);

const describeDerivedAlarm = (type: string, latest: TelemetryPoint, language: DashboardLanguage) => {
  const es = {
    soc_low: `El estado de carga bajó a ${fixed(latest.batteryPct, 0)}%.`,
    soc_critical: `El estado de carga cayó a ${fixed(latest.batteryPct, 0)}% y hay riesgo de interrupción.`,
    battery_voltage_low: `El voltaje DC está en ${fixed(latest.genVoltageV, 1)} V, por debajo del rango preferido.`,
    battery_voltage_high: `El voltaje DC está en ${fixed(latest.genVoltageV, 1)} V, por encima del rango preferido.`,
    battery_discharge_current_high: `La descarga DC alcanzó ${fixed(latest.genCurrentA, 1)} A.`,
    battery_charge_current_high: `La carga DC alcanzó ${fixed(latest.genCurrentA, 1)} A en sentido de carga.`,
    ac_voltage_low: `La salida AC bajó a ${fixed(latest.outputVoltageAcV, 1)} V.`,
    ac_voltage_high: `La salida AC subió a ${fixed(latest.outputVoltageAcV, 1)} V.`,
    ac_current_high: `La corriente AC llegó a ${fixed(latest.outputCurrentAcA, 1)} A.`,
    house_power_high: `La vivienda está demandando ${fixed(latest.loadPowerW, 0)} W.`,
    supply_cut: `La salida AC cayó a ${fixed(latest.outputVoltageAcV, 1)} V y no hay suministro estable.`,
    inverter_temp_high: `La temperatura del inversor está en ${fixed(latest.genTempC, 1)} C.`,
    low_wind: `La velocidad del viento está en ${fixed(latest.windSpeedMs, 1)} m/s.`,
    high_wind: `La velocidad del viento subió a ${fixed(latest.windSpeedMs, 1)} m/s.`,
    vibration_high: `La vibración del motor llegó a ${fixed(latest.vibrationRms, 2)} RMS.`,
    vibration_critical: `La vibración del motor alcanzó ${fixed(latest.vibrationRms, 2)} RMS en nivel crítico.`,
    rotor_rpm_out_of_range: `El rotor alcanzó ${fixed(latest.rotorRpm, 0)} rpm.`,
  } satisfies Record<string, string>;

  const en = {
    soc_low: `State of charge dropped to ${fixed(latest.batteryPct, 0)}%.`,
    soc_critical: `State of charge fell to ${fixed(latest.batteryPct, 0)}% and service is at risk.`,
    battery_voltage_low: `Battery DC voltage is ${fixed(latest.genVoltageV, 1)} V, below the preferred band.`,
    battery_voltage_high: `Battery DC voltage is ${fixed(latest.genVoltageV, 1)} V, above the preferred band.`,
    battery_discharge_current_high: `Battery discharge current reached ${fixed(latest.genCurrentA, 1)} A.`,
    battery_charge_current_high: `Battery charge current reached ${fixed(latest.genCurrentA, 1)} A in charging direction.`,
    ac_voltage_low: `AC output dropped to ${fixed(latest.outputVoltageAcV, 1)} V.`,
    ac_voltage_high: `AC output rose to ${fixed(latest.outputVoltageAcV, 1)} V.`,
    ac_current_high: `AC current reached ${fixed(latest.outputCurrentAcA, 1)} A.`,
    house_power_high: `The household is demanding ${fixed(latest.loadPowerW, 0)} W.`,
    supply_cut: `AC output dropped to ${fixed(latest.outputVoltageAcV, 1)} V and supply is not stable.`,
    inverter_temp_high: `Inverter temperature is ${fixed(latest.genTempC, 1)} C.`,
    low_wind: `Wind speed is ${fixed(latest.windSpeedMs, 1)} m/s.`,
    high_wind: `Wind speed increased to ${fixed(latest.windSpeedMs, 1)} m/s.`,
    vibration_high: `Motor vibration reached ${fixed(latest.vibrationRms, 2)} RMS.`,
    vibration_critical: `Motor vibration reached ${fixed(latest.vibrationRms, 2)} RMS at critical level.`,
    rotor_rpm_out_of_range: `Rotor speed reached ${fixed(latest.rotorRpm, 0)} rpm.`,
  } satisfies Record<string, string>;

  const qu = {
    soc_low: `Carga estadonqa ${fixed(latest.batteryPct, 0)}%-man uraykurqan.`,
    soc_critical: `Carga estadonqa ${fixed(latest.batteryPct, 0)}%-man uraykurqan hinaspa servicioqa peligropi kashan.`,
    battery_voltage_low: `Bateria DC voltajeqa ${fixed(latest.genVoltageV, 1)} V-manta pisi kashan.`,
    battery_voltage_high: `Bateria DC voltajeqa ${fixed(latest.genVoltageV, 1)} V-manta aswan hatun kashan.`,
    battery_discharge_current_high: `Bateria descarga corrienteqa ${fixed(latest.genCurrentA, 1)} A-man chayarqan.`,
    battery_charge_current_high: `Bateria carga corrienteqa ${fixed(latest.genCurrentA, 1)} A-man chayarqan.`,
    ac_voltage_low: `AC lloqsimuyqa ${fixed(latest.outputVoltageAcV, 1)} V-man uraykurqan.`,
    ac_voltage_high: `AC lloqsimuyqa ${fixed(latest.outputVoltageAcV, 1)} V-man wicharqan.`,
    ac_current_high: `AC corrienteqa ${fixed(latest.outputCurrentAcA, 1)} A-man chayarqan.`,
    house_power_high: `Wasipa demandanqa ${fixed(latest.loadPowerW, 0)} W-manta kashan.`,
    supply_cut: `AC lloqsimuyqa ${fixed(latest.outputVoltageAcV, 1)} V-man uraykurqan hinaspa mana establechu.`,
    inverter_temp_high: `Inversor temperaturaqa ${fixed(latest.genTempC, 1)} C-manta kashan.`,
    low_wind: `Wayra velocidadqa ${fixed(latest.windSpeedMs, 1)} m/s-manta kashan.`,
    high_wind: `Wayra velocidadqa ${fixed(latest.windSpeedMs, 1)} m/s-man wicharqan.`,
    vibration_high: `Motor vibracionqa ${fixed(latest.vibrationRms, 2)} RMS-man chayarqan.`,
    vibration_critical: `Motor vibracionqa ${fixed(latest.vibrationRms, 2)} RMS-man critico nivelpi chayarqan.`,
    rotor_rpm_out_of_range: `Rotorqa ${fixed(latest.rotorRpm, 0)} rpm-man chayarqan.`,
  } satisfies Record<string, string>;

  const zh = {
    soc_low: `电量已降至 ${fixed(latest.batteryPct, 0)}%。`,
    soc_critical: `电量已降至 ${fixed(latest.batteryPct, 0)}%，存在供电中断风险。`,
    battery_voltage_low: `电池直流电压为 ${fixed(latest.genVoltageV, 1)} V，低于建议范围。`,
    battery_voltage_high: `电池直流电压为 ${fixed(latest.genVoltageV, 1)} V，高于建议范围。`,
    battery_discharge_current_high: `电池放电电流达到 ${fixed(latest.genCurrentA, 1)} A。`,
    battery_charge_current_high: `电池充电电流达到 ${fixed(latest.genCurrentA, 1)} A。`,
    ac_voltage_low: `交流输出已降至 ${fixed(latest.outputVoltageAcV, 1)} V。`,
    ac_voltage_high: `交流输出升至 ${fixed(latest.outputVoltageAcV, 1)} V。`,
    ac_current_high: `交流电流达到 ${fixed(latest.outputCurrentAcA, 1)} A。`,
    house_power_high: `住户当前负载为 ${fixed(latest.loadPowerW, 0)} W。`,
    supply_cut: `交流输出降至 ${fixed(latest.outputVoltageAcV, 1)} V，供电不稳定。`,
    inverter_temp_high: `逆变器温度为 ${fixed(latest.genTempC, 1)} C。`,
    low_wind: `风速为 ${fixed(latest.windSpeedMs, 1)} m/s。`,
    high_wind: `风速升至 ${fixed(latest.windSpeedMs, 1)} m/s。`,
    vibration_high: `电机振动达到 ${fixed(latest.vibrationRms, 2)} RMS。`,
    vibration_critical: `电机振动达到 ${fixed(latest.vibrationRms, 2)} RMS，已到严重等级。`,
    rotor_rpm_out_of_range: `转子转速达到 ${fixed(latest.rotorRpm, 0)} rpm。`,
  } satisfies Record<string, string>;

  const dictByLanguage: Record<DashboardLanguage, Record<string, string>> = {
    en,
    es,
    qu,
    zh,
  };
  const dict = dictByLanguage[language] || en;
  return dict[type] || translateDashboard(language, "alarm.title.default");
};

const createDerivedAlarm = (
  type: string,
  severity: AlarmItem["severity"],
  latest: TelemetryPoint,
  language: DashboardLanguage,
): AlarmItem => ({
  id: `${derivedPrefix}${type}`,
  type,
  rawType: type,
  severity,
  title: translateDashboard(language, `alarm.title.${type}`),
  description: describeDerivedAlarm(type, latest, language),
  timestamp: latest.timestamp,
  status: "open",
  deviceId: ENV.deviceId,
  suggestedAction: translateDashboard(language, `alarm.action.${type}`),
});

const deriveOperationalAlarms = (latest: TelemetryPoint | null, language: DashboardLanguage) => {
  if (!latest) return [] as AlarmItem[];

  const alarms: AlarmItem[] = [];
  const push = (condition: boolean, type: string, severity: AlarmItem["severity"]) => {
    if (condition) alarms.push(createDerivedAlarm(type, severity, latest, language));
  };

  push((latest.batteryPct ?? 100) <= 10, "soc_critical", "critical");
  push((latest.batteryPct ?? 100) > 10 && (latest.batteryPct ?? 100) < 20, "soc_low", "warning");

  push((latest.genVoltageV ?? 0) < 42, "battery_voltage_low", "critical");
  push((latest.genVoltageV ?? 0) >= 42 && (latest.genVoltageV ?? 0) < 46, "battery_voltage_low", "warning");
  push((latest.genVoltageV ?? 0) > 58, "battery_voltage_high", "critical");
  push((latest.genVoltageV ?? 0) > 55 && (latest.genVoltageV ?? 0) <= 58, "battery_voltage_high", "warning");

  push((latest.genCurrentA ?? 0) >= 24, "battery_discharge_current_high", "critical");
  push((latest.genCurrentA ?? 0) >= 18 && (latest.genCurrentA ?? 0) < 24, "battery_discharge_current_high", "warning");
  push((latest.genCurrentA ?? 0) <= -24, "battery_charge_current_high", "critical");
  push((latest.genCurrentA ?? 0) <= -18 && (latest.genCurrentA ?? 0) > -24, "battery_charge_current_high", "warning");

  push((latest.outputVoltageAcV ?? 230) < 190, "ac_voltage_low", "critical");
  push((latest.outputVoltageAcV ?? 230) >= 190 && (latest.outputVoltageAcV ?? 230) < 210, "ac_voltage_low", "warning");
  push((latest.outputVoltageAcV ?? 230) > 250, "ac_voltage_high", "critical");
  push((latest.outputVoltageAcV ?? 230) > 240 && (latest.outputVoltageAcV ?? 230) <= 250, "ac_voltage_high", "warning");

  push((latest.outputCurrentAcA ?? 0) >= 12, "ac_current_high", "critical");
  push((latest.outputCurrentAcA ?? 0) >= 8 && (latest.outputCurrentAcA ?? 0) < 12, "ac_current_high", "warning");

  push((latest.loadPowerW ?? 0) >= 2200, "house_power_high", "critical");
  push((latest.loadPowerW ?? 0) >= 1800 && (latest.loadPowerW ?? 0) < 2200, "house_power_high", "warning");

  push((latest.outputVoltageAcV ?? 230) < 50, "supply_cut", "critical");

  push((latest.genTempC ?? 0) > 70, "inverter_temp_high", "critical");
  push((latest.genTempC ?? 0) > 55 && (latest.genTempC ?? 0) <= 70, "inverter_temp_high", "warning");

  push((latest.windSpeedMs ?? 100) < 3, "low_wind", "warning");
  push((latest.windSpeedMs ?? 0) > 24, "high_wind", "critical");
  push((latest.windSpeedMs ?? 0) > 20 && (latest.windSpeedMs ?? 0) <= 24, "high_wind", "warning");

  push((latest.vibrationRms ?? 0) >= 7, "vibration_critical", "critical");
  push((latest.vibrationRms ?? 0) >= 4 && (latest.vibrationRms ?? 0) < 7, "vibration_high", "warning");

  push((latest.rotorRpm ?? 0) >= 750, "rotor_rpm_out_of_range", "critical");
  push((latest.rotorRpm ?? 0) >= 650 && (latest.rotorRpm ?? 0) < 750, "rotor_rpm_out_of_range", "warning");

  return alarms;
};

const mergeRemoteAndDerived = (alarms: AlarmItem[]) => {
  const deduped = new Map<string, AlarmItem>();

  const sorted = [...alarms].sort((left, right) => {
    const leftRemote = left.id.startsWith(derivedPrefix) ? 1 : 0;
    const rightRemote = right.id.startsWith(derivedPrefix) ? 1 : 0;
    return leftRemote - rightRemote;
  });

  for (const alarm of sorted) {
    const key = `${alarm.type}:${alarm.status}`;
    if (!deduped.has(key)) deduped.set(key, alarm);
  }

  return [...deduped.values()].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
};

export const alertsService = {
  async list(
    deviceId = ENV.deviceId,
    language: DashboardLanguage = "en",
  ): Promise<AlarmItem[]> {
    if (ENV.useMockData || !apiClient.hasApi) {
      return buildMockAlarms(language);
    }

    const response = await apiClient.get<any[]>("/alerts/recent", {
      params: { deviceId },
    });

    return response.map((item) => normalizeAlarm(item, language));
  },

  async acknowledge(alertId: string, language: DashboardLanguage = "en") {
    if (
      alertId.startsWith(derivedPrefix) ||
      alertId.startsWith("telemetry:") ||
      alertId.startsWith("ai:")
    ) {
      return null;
    }
    if (ENV.useMockData || !apiClient.hasApi) return null;
    const response = await apiClient.post<any>(`/alerts/${alertId}/ack`);
    return normalizeAlarm(response, language);
  },

  isDerived(alarm: AlarmItem) {
    return alarm.id.startsWith(derivedPrefix);
  },

  enrichOperational(
    latest: TelemetryPoint | null,
    alarms: AlarmItem[],
    language: DashboardLanguage = "en",
  ) {
    const remote = alarms.filter((alarm) => !alarm.id.startsWith(derivedPrefix));
    const derived = deriveOperationalAlarms(latest, language);
    return mergeRemoteAndDerived([...remote, ...derived]);
  },
};
