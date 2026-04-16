import {
  AlarmItem,
  ComponentState,
  ConnectivityStatus,
  DigitalTwinState,
  MaintenanceItem,
  TelemetryPoint,
  TimeRange,
} from "@/types/dashboard";
import {
  DashboardLanguage,
  translateDashboard,
} from "@/i18n/translations";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const mockScenario = {
  windSpeedMs: 2.8,
  windDirectionDeg: 236,
  genVoltageV: 45.6,
  genCurrentA: 18.7,
  outputVoltageAcV: 219.4,
  outputCurrentAcA: 3.1,
  vibrationRms: 4.36,
  vibrationSignal: 0.472,
  genTempC: 57.8,
  rotorRpm: 618,
  batteryPct: 18,
  loadPowerW: 680,
  powerW: 853,
  estimatedAutonomyHours: 0.8,
  energyTodayKwh: 4.7,
  sourceNow: "BATTERY" as const,
  sourceReason: "Low wind keeps the battery supporting the household load.",
  mode: "mock",
};

const rangeCount: Record<TimeRange, number> = {
  "1h": 12,
  "6h": 24,
  "24h": 36,
  "7d": 42,
};

const rangeStepMinutes: Record<TimeRange, number> = {
  "1h": 5,
  "6h": 15,
  "24h": 40,
  "7d": 240,
};

export const createSyntheticHistory = (latest: TelemetryPoint | null, range: TimeRange): TelemetryPoint[] => {
  const count = rangeCount[range];
  const stepMinutes = rangeStepMinutes[range];
  const now = latest?.timestamp ? new Date(latest.timestamp) : new Date();
  const base = latest || buildMockLatest();

  return Array.from({ length: count }, (_, index) => {
    const age = count - index - 1;
    const timestamp = new Date(now.getTime() - age * stepMinutes * 60_000);
    const progress = index / Math.max(1, count - 1);
    const pull = 1 - progress;
    const wave = Math.sin((index + 1) * 0.45);
    const waveB = Math.cos((index + 1) * 0.21);

    const wind = clamp((base.windSpeedMs ?? 2.8) + pull * 4.8 + wave * 0.7 + waveB * 0.3, 0, 28);
    const windDirection = (((base.windDirectionDeg ?? 236) - pull * 28 + index * 3 + wave * 12) % 360 + 360) % 360;
    const voltage = clamp((base.genVoltageV ?? 45.6) + pull * 2.4 + waveB * 0.5, 42, 58);
    const current = clamp((base.genCurrentA ?? 18.7) - pull * 6.2 + wave * 1.1, 0, 36);
    const power = clamp(voltage * current, 0, 2800);
    const acVoltage = clamp((base.outputVoltageAcV ?? 219.4) + pull * 8.1 + wave * 2.2, 180, 252);
    const acCurrent = clamp((base.outputCurrentAcA ?? 3.1) + waveB * 0.22 + pull * 0.18, 0, 18);
    const load = clamp((base.loadPowerW ?? 680) + waveB * 70 + pull * 60, 120, 2800);
    const battery = clamp((base.batteryPct ?? 18) + pull * 19 + waveB * 2.4, 5, 100);
    const vibration = clamp((base.vibrationRms ?? 4.36) - pull * 0.7 + Math.abs(wave) * 0.55, 0.2, 12);
    const vibrationSignal = clamp((base.vibrationSignal ?? 0.472) - pull * 0.06 + wave * 0.025, 0.05, 1.2);
    const temp = clamp((base.genTempC ?? 57.8) - pull * 6.4 + Math.abs(wave) * 2.1, 22, 96);
    const rotorRpm = clamp((base.rotorRpm ?? 618) + pull * 74 + waveB * 18, 0, 980);
    const autonomy = load > 0 ? clamp(((battery / 100) * 3 / (load / 1000)), 0, 16) : null;

    return {
      timestamp: timestamp.toISOString(),
      windSpeedMs: Number(wind.toFixed(2)),
      windDirectionDeg: Number(windDirection.toFixed(0)),
      genVoltageV: Number(voltage.toFixed(2)),
      genCurrentA: Number(current.toFixed(2)),
      outputVoltageAcV: Number(acVoltage.toFixed(1)),
      outputCurrentAcA: Number(acCurrent.toFixed(2)),
      vibrationRms: Number(vibration.toFixed(2)),
      vibrationSignal: Number(vibrationSignal.toFixed(3)),
      genTempC: Number(temp.toFixed(2)),
      rotorRpm: Number(rotorRpm.toFixed(0)),
      batteryPct: Number(battery.toFixed(0)),
      estimatedAutonomyHours: autonomy === null ? null : Number(autonomy.toFixed(1)),
      loadPowerW: Number(load.toFixed(0)),
      powerW: Number(power.toFixed(0)),
      energyTodayKwh: Number(((base.energyTodayKwh ?? 4.7) * (0.48 + progress * 0.52)).toFixed(2)),
      sourceNow: wind < 3.5 ? "BATTERY" : power >= load ? "WIND" : "BOTH",
      sourceReason: null,
      mode: base.mode ?? "mock",
    };
  });
};

export const buildMockLatest = (): TelemetryPoint => {
  const now = new Date();
  return {
    timestamp: now.toISOString(),
    ...mockScenario,
  };
};

export const buildMockAlarms = (
  language: DashboardLanguage = "en",
): AlarmItem[] => {
  const now = Date.now();
  return [
    {
      id: "alarm-warning-01",
      type: "controller_overload",
      rawType: "controller_overload",
      severity: "warning",
      title: translateDashboard(language, "alarm.title.controller_overload"),
      description:
        language === "es"
          ? "El controlador registro una sobrecarga puntual mientras la bateria sostenia la vivienda."
          : "The controller logged a brief overload while the battery supported the household.",
      timestamp: new Date(now - 95 * 60_000).toISOString(),
      status: "acknowledged",
      deviceId: "AE-01",
      suggestedAction: translateDashboard(language, "alarm.action.controller_overload"),
    },
    {
      id: "alarm-resolved-01",
      type: "supply_cut",
      rawType: "supply_cut",
      severity: "warning",
      title: translateDashboard(language, "alarm.title.supply_cut"),
      description:
        language === "es"
          ? "La salida AC se interrumpio por un intervalo corto y luego se recupero."
          : "AC output was interrupted for a short interval and then recovered.",
      timestamp: new Date(now - 6 * 60 * 60_000).toISOString(),
      status: "resolved",
      deviceId: "AE-01",
      suggestedAction: translateDashboard(language, "alarm.action.supply_cut"),
    },
    {
      id: "alarm-resolved-02",
      type: "inverter_fault",
      rawType: "inverter_fault",
      severity: "warning",
      title: translateDashboard(language, "alarm.title.inverter_fault"),
      description:
        language === "es"
          ? "Se detecto una falla transitoria del inversor en la madrugada y quedo registrada para revision."
          : "A transient inverter fault was detected overnight and logged for review.",
      timestamp: new Date(now - 19 * 60 * 60_000).toISOString(),
      status: "resolved",
      deviceId: "AE-01",
      suggestedAction: translateDashboard(language, "alarm.action.inverter_fault"),
    },
  ];
};

export const buildMockMaintenance = (
  language: DashboardLanguage = "en",
): MaintenanceItem[] => {
  const now = Date.now();
  return [
    {
      id: "mnt-corrective-01",
      category: "corrective",
      title: translateDashboard(language, "maintenance.item.corrective.generator.title"),
      description:
        language === "es"
          ? "La temperatura del inversor sigue alta y la vibracion exige una revision correctiva en campo."
          : "Inverter temperature remains high and vibration calls for corrective field inspection.",
      priority: "critical",
      status: "new",
      component: "Inverter and rotor support",
      sourceRule: "thermal-threshold-crossed",
      createdAt: new Date(now - 20 * 60_000).toISOString(),
      dueDate: new Date(now + 4 * 60 * 60_000).toISOString(),
      recommendedAction: translateDashboard(language, "maintenance.item.corrective.generator.action"),
    },
    {
      id: "mnt-preventive-01",
      category: "preventive",
      title: translateDashboard(language, "maintenance.item.preventive.electrical.title"),
      description:
        language === "es"
          ? "Inspeccion rutinaria de salida AC, tablero y cableado hacia la vivienda."
          : "Routine inspection of AC output, board and wiring toward the household.",
      priority: "medium",
      status: "scheduled",
      component: "Electrical system",
      sourceRule: "calendar-weekly",
      createdAt: new Date(now - 2 * 24 * 60 * 60_000).toISOString(),
      dueDate: new Date(now + 2 * 24 * 60 * 60_000).toISOString(),
      recommendedAction: translateDashboard(language, "maintenance.item.preventive.electrical.action"),
    },
    {
      id: "mnt-predictive-01",
      category: "predictive",
      title: translateDashboard(language, "maintenance.item.predictive.rotor.title"),
      description:
        language === "es"
          ? "La combinacion de vibracion y RPM sugiere revisar balance y apriete del conjunto rotativo."
          : "The combination of vibration and RPM suggests checking balance and fasteners on the rotating assembly.",
      priority: "high",
      status: "in_progress",
      component: "Rotor",
      sourceRule: "vibration-trend-slope",
      createdAt: new Date(now - 10 * 60 * 60_000).toISOString(),
      dueDate: new Date(now + 18 * 60 * 60_000).toISOString(),
      recommendedAction: translateDashboard(language, "maintenance.item.predictive.rotor.action"),
    },
  ];
};

export const buildMockTwin = (connectivityStatus: ConnectivityStatus = "live"): DigitalTwinState => {
  const status = (value: ComponentState): ComponentState => (connectivityStatus === "offline" ? "offline" : value);
  return {
    rotorStatus: status("warning"),
    generatorStatus: status("warning"),
    towerStatus: status("normal"),
    electricalStatus: status("warning"),
    batteryStatus: status("warning"),
    sensorsStatus: status("normal"),
    connectivityStatus: connectivityStatus === "offline" ? "offline" : "normal",
    windDirectionDeg: 236,
    windDirectionStatus: status("normal"),
    temperatureStatus: status("warning"),
    vibrationStatus: status("warning"),
    voltageStatus: status("warning"),
    powerFlowLevel: 0.48,
    animationLevel: 0.34,
    highlights: ["battery", "electrical", "rotor"],
    warnings: ["Low wind, battery is supporting supply", "Inverter temperature remains above preferred range"],
  };
};
