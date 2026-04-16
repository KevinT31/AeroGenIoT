import { AlarmItem, MaintenanceItem, TelemetryPoint } from "@/types/dashboard";
import {
  DashboardLanguage,
  translateDashboard,
} from "@/i18n/translations";
import { buildMockMaintenance } from "./mockData";

const plusHours = (hours: number) => new Date(Date.now() + hours * 60 * 60_000).toISOString();
const nowIso = () => new Date().toISOString();

export const maintenanceService = {
  derive(
    latest: TelemetryPoint | null,
    history: TelemetryPoint[],
    alarms: AlarmItem[],
    language: DashboardLanguage = "en",
  ): MaintenanceItem[] {
    if (!latest) return buildMockMaintenance(language);

    const items: MaintenanceItem[] = [];
    const openAlarms = alarms.filter((alarm) => alarm.status === "open");
    const avgVibration = average(history.map((point) => point.vibrationRms));
    const lastVibration = latest.vibrationRms ?? 0;
    const vibrationSlope = history.length > 6 ? lastVibration - (history[Math.max(0, history.length - 6)].vibrationRms ?? lastVibration) : 0;
    const avgTemp = average(history.map((point) => point.genTempC));

    if ((latest.genTempC ?? 0) > 70 || openAlarms.some((alarm) => alarm.type === "inverter_temp_high" || alarm.type === "battery_overtemperature")) {
      items.push({
        id: "corrective-generator-thermal",
        category: "corrective",
        title: translateDashboard(language, "maintenance.item.corrective.generator.title"),
        description: translateDashboard(language, "maintenance.item.corrective.generator.description"),
        priority: "critical",
        status: "new",
        component: "Inverter / controller",
        sourceRule: "temp-above-threshold",
        createdAt: nowIso(),
        dueDate: plusHours(2),
        recommendedAction: translateDashboard(language, "maintenance.item.corrective.generator.action"),
      });
    }

    if ((latest.vibrationRms ?? 0) > 7 || openAlarms.some((alarm) => alarm.type === "vibration_high" || alarm.type === "vibration_critical")) {
      items.push({
        id: "corrective-rotor-vibration",
        category: "corrective",
        title: translateDashboard(language, "maintenance.item.corrective.rotor.title"),
        description: translateDashboard(language, "maintenance.item.corrective.rotor.description"),
        priority: "high",
        status: "new",
        component: "Rotor",
        sourceRule: "vibration-threshold-crossed",
        createdAt: nowIso(),
        dueDate: plusHours(8),
        recommendedAction: translateDashboard(language, "maintenance.item.corrective.rotor.action"),
      });
    }

    items.push({
      id: "preventive-electrical-weekly",
      category: "preventive",
      title: translateDashboard(language, "maintenance.item.preventive.electrical.title"),
      description: translateDashboard(language, "maintenance.item.preventive.electrical.description"),
      priority: "medium",
      status: "scheduled",
      component: "Electrical system",
      sourceRule: "calendar-weekly",
      createdAt: nowIso(),
      dueDate: plusHours(36),
      recommendedAction: translateDashboard(language, "maintenance.item.preventive.electrical.action"),
    });

    if ((avgVibration ?? 0) > 3.6 || vibrationSlope > 0.45) {
      items.push({
        id: "predictive-rotor-drift",
        category: "predictive",
        title: translateDashboard(language, "maintenance.item.predictive.rotor.title"),
        description: translateDashboard(language, "maintenance.item.predictive.rotor.description"),
        priority: "high",
        status: "in_progress",
        component: "Rotor",
        sourceRule: "vibration-trend-slope",
        createdAt: nowIso(),
        dueDate: plusHours(18),
        recommendedAction: translateDashboard(language, "maintenance.item.predictive.rotor.action"),
      });
    }

    if ((avgTemp ?? 0) > 58 || openAlarms.some((alarm) => alarm.type === "rotor_rpm_out_of_range")) {
      items.push({
        id: "predictive-thermal-pattern",
        category: "predictive",
        title: translateDashboard(language, "maintenance.item.predictive.thermal.title"),
        description: translateDashboard(language, "maintenance.item.predictive.thermal.description"),
        priority: "medium",
        status: "new",
        component: "Generator",
        sourceRule: "thermal-pattern-drift",
        createdAt: nowIso(),
        dueDate: plusHours(24),
        recommendedAction: translateDashboard(language, "maintenance.item.predictive.thermal.action"),
      });
    }

    return items;
  },
};

const average = (values: Array<number | null>) => {
  const numeric = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!numeric.length) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
};
