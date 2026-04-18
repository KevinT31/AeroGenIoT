import { AiOperationalSnapshot, AlarmItem, MaintenanceItem, TelemetryPoint } from "@/types/dashboard";
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
    ai: AiOperationalSnapshot | null,
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

    const aiVisitItem = buildAiVisitItem(latest, ai, language);
    if (aiVisitItem) {
      items.push(aiVisitItem);
    }

    return items;
  },
};

const average = (values: Array<number | null>) => {
  const numeric = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!numeric.length) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
};

const circularDelta = (left: number, right: number) => {
  const diff = Math.abs(left - right) % 360;
  return diff > 180 ? 360 - diff : diff;
};

const faultLabel = (language: DashboardLanguage, label: string | null) => {
  const dict = {
    en: {
      high_temp: "high inverter temperature",
      high_vibration: "high motor vibration",
      low_battery: "low battery reserve",
      overload: "overload risk",
    },
    es: {
      high_temp: "temperatura alta del inversor",
      high_vibration: "vibracion alta del motor",
      low_battery: "reserva baja de bateria",
      overload: "riesgo de sobrecarga",
    },
    qu: {
      high_temp: "inversorpi alta temperatura",
      high_vibration: "motorpi alta vibracion",
      low_battery: "bateria reserva pisi",
      overload: "sobrecarga riesgo",
    },
    zh: {
      high_temp: "逆变器温度过高",
      high_vibration: "电机振动过高",
      low_battery: "电池储备偏低",
      overload: "过载风险",
    },
  } as const;

  if (!label) {
    if (language === "es") return "riesgo operativo";
    if (language === "qu") return "operativo riesgo";
    if (language === "zh") return "运行风险";
    return "operational risk";
  }
  return dict[language][label as keyof (typeof dict)[typeof language]] ??
    label.replace(/[_-]+/g, " ");
};

const visitTitle = (language: DashboardLanguage) =>
  language === "es"
    ? "Planificar proxima visita tecnica"
    : language === "qu"
      ? "Hamuq tecnica visitata planiy"
      : language === "zh"
        ? "规划下一次技术巡检"
        : "Plan the next technical visit";

const withWindow = (language: DashboardLanguage, hours: number, reason: string) =>
  language === "es"
    ? `La IA operativa recomienda intervenir en las proximas ${hours} h por ${reason}.`
    : language === "qu"
      ? `IA operativaqa ${hours} h ukhupi hamuyta nin ${reason} rayku.`
      : language === "zh"
        ? `运行 AI 建议在未来 ${hours} 小时内介入，原因是 ${reason}。`
        : `Operational AI recommends intervention within the next ${hours} h due to ${reason}.`;

const buildAiVisitItem = (
  latest: TelemetryPoint,
  ai: AiOperationalSnapshot | null,
  language: DashboardLanguage,
): MaintenanceItem | null => {
  if (!ai) return null;

  const candidates: Array<{
    priority: MaintenanceItem["priority"];
    status: MaintenanceItem["status"];
    dueHours: number;
    component: string;
    sourceRule: string;
    reason: string;
    recommendedAction: string;
  }> = [];

  const fault = ai.faultPrediction;
  if (
    fault?.label &&
    fault.label !== "nominal_operation" &&
    (fault.confidencePct ?? 0) >= 60
  ) {
    const label = String(fault.label).toLowerCase();
    const reason = faultLabel(language, label);
    const dueHours =
      label === "high_vibration"
        ? fault.severity === "critical"
          ? 6
          : 18
        : label === "high_temp"
          ? fault.severity === "critical"
            ? 8
            : 24
          : label === "overload"
            ? 12
            : fault.severity === "critical"
              ? 12
              : 36;
    const priority =
      fault.severity === "critical"
        ? "critical"
        : (fault.confidencePct ?? 0) >= 85
          ? "high"
          : "medium";

    candidates.push({
      priority,
      status: priority === "critical" ? "new" : "scheduled",
      dueHours,
      component:
        label === "high_vibration"
          ? language === "es" || language === "qu"
            ? "Rotor"
            : language === "zh"
              ? "转子"
              : "Rotor"
          : label === "high_temp"
            ? language === "es"
              ? "Inversor"
              : language === "qu"
                ? "Inversor"
                : language === "zh"
                  ? "逆变器"
                  : "Inverter"
            : label === "low_battery"
              ? language === "es"
                ? "Bateria"
                : language === "qu"
                  ? "Bateria"
                  : language === "zh"
                    ? "电池"
                    : "Battery"
              : language === "es"
                ? "Etapa de potencia"
                : language === "qu"
                  ? "Potencia etapa"
                  : language === "zh"
                    ? "功率级"
                    : "Power stage",
      sourceRule: "ai-fault-risk",
      reason,
      recommendedAction:
        fault.recommendedAction ||
        (language === "es"
          ? "Confirmar la causa probable y preparar repuestos antes de la visita."
          : language === "qu"
            ? "Probable causata qhawariy hinaspa repuestokunata wakichiy."
            : language === "zh"
              ? "确认可能原因，并在巡检前准备备件。"
              : "Confirm the probable cause and prepare spare parts before the visit."),
    });
  }

  const forecast = ai.powerForecast;
  const predictedPower = forecast?.predictedPowerW ?? null;
  const demandPower = latest.loadPowerW ?? 0;
  const reserve = latest.batteryPct ?? 100;
  if (
    predictedPower !== null &&
    (predictedPower < 280 || (demandPower > 0 && demandPower - predictedPower > 320))
  ) {
    const lowReserve = reserve < 35;
    const reason =
      language === "es"
        ? `pronostico de potencia insuficiente frente a la demanda (${Math.round(predictedPower)} W esperados)`
        : language === "qu"
          ? `potencia pronostico demandaq manam aypanchu (${Math.round(predictedPower)} W suyasqa)`
          : language === "zh"
            ? `预测功率不足以覆盖需求（预计 ${Math.round(predictedPower)} W）`
            : `insufficient power forecast versus demand (${Math.round(predictedPower)} W expected)`;

    candidates.push({
      priority: lowReserve ? "high" : "medium",
      status: lowReserve ? "new" : "scheduled",
      dueHours: lowReserve ? 12 : 30,
      component:
        language === "es"
          ? "Captacion eolica y reserva"
          : language === "qu"
            ? "Wayra hap'iy hinaspa reserva"
            : language === "zh"
              ? "风能获取与储备"
              : "Wind capture and reserve",
      sourceRule: "ai-power-gap",
      reason,
      recommendedAction:
        language === "es"
          ? "Preparar visita para revisar captacion de viento, cargas y estrategia de respaldo."
          : language === "qu"
            ? "Wayra hap'iyta, cargakunata hinaspa respaldo estrategiata qhawarinapaq visita wakichiy."
            : language === "zh"
              ? "安排巡检，检查风能获取、负载和储能备用策略。"
              : "Prepare a visit to review wind capture, loads and storage backup strategy.",
    });
  }

  const yaw = ai.yawRecommendation;
  const yawTarget = yaw?.targetYawDeg ?? null;
  const liveDirection = latest.windDirectionDeg ?? null;
  const yawDelta =
    yawTarget === null || liveDirection === null ? null : circularDelta(yawTarget, liveDirection);

  if (
    yawTarget !== null &&
    (yaw?.confidencePct ?? 0) >= 70 &&
    (yawDelta === null || yawDelta >= 18 || Boolean(yaw?.reason))
  ) {
    const reason =
      yaw?.reason ||
      (yawDelta === null
        ? language === "es"
          ? "recomendacion de orientacion pendiente de validar en campo"
          : language === "qu"
            ? "orientacion rekomendacion chakra pampapi qhawarinapaq"
            : language === "zh"
              ? "偏航建议仍需现场确认"
              : "yaw recommendation pending field validation"
        : language === "es"
          ? `desalineacion potencial de ${Math.round(yawDelta)} grados`
          : language === "qu"
            ? `${Math.round(yawDelta)} grado potencial desalineacion`
            : language === "zh"
              ? `可能存在 ${Math.round(yawDelta)} 度偏差`
              : `potential ${Math.round(yawDelta)} degree misalignment`);

    candidates.push({
      priority: yawDelta !== null && yawDelta >= 35 ? "high" : "medium",
      status: "scheduled",
      dueHours: yawDelta !== null && yawDelta >= 35 ? 18 : 48,
      component:
        language === "es"
          ? "Orientacion de gondola"
          : language === "qu"
            ? "Gondola orientacion"
            : language === "zh"
              ? "机舱偏航校准"
              : "Yaw alignment",
      sourceRule: "ai-yaw-alignment",
      reason,
      recommendedAction:
        yaw?.action ||
        (language === "es"
          ? "Verificar orientacion real de la gondola y ajustar antes de la siguiente ventana de viento fuerte."
          : language === "qu"
            ? "Gondolapa chiqaq orientacionninta qhawariy hinaspa manaraq sinchi wayra hamuqtin allinchay."
            : language === "zh"
              ? "在下一次强风窗口前确认机舱真实朝向并完成调整。"
              : "Verify real nacelle alignment and adjust before the next strong-wind window."),
    });
  }

  if (!candidates.length) return null;

  const selected = [...candidates].sort((left, right) => left.dueHours - right.dueHours)[0];

  return {
    id: `predictive-ai-${selected.sourceRule}`,
    category: "predictive",
    title: visitTitle(language),
    description: withWindow(language, selected.dueHours, selected.reason),
    priority: selected.priority,
    status: selected.status,
    component: selected.component,
    sourceRule: selected.sourceRule,
    createdAt: nowIso(),
    dueDate: plusHours(selected.dueHours),
    recommendedAction: selected.recommendedAction,
  };
};
