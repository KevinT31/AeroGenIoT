import React from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { HeroBanner } from "../components/HeroBanner";
import { Panel } from "../components/Panel";
import { ScreenLayout } from "../components/ScreenLayout";
import { StatusTag } from "../components/StatusTag";
import { useI18n } from "../i18n/LanguageContext";
import { AppLanguage } from "../i18n/translations";
import { useAero } from "../state/AeroContext";
import { fonts, palette, radius, spacing } from "../theme";
import { OperationalAiSnapshot, TelemetryReading } from "../types/aerogen";

const copy = {
  es: {
    heroTitle: "IA operativa",
    heroSubtitle: "Predicciones y sugerencias para anticipar revisiones tecnicas.",
    sectionTitle: "IA operativa",
    fault: "Falla probable",
    power: "Pronostico",
    yaw: "Orientacion",
    visit: "Proxima visita",
    monitoring: "En observacion",
    noForecast: "Sin pronostico util",
    noYaw: "Sin recomendacion",
    noVisit: "Sin visita urgente",
    confidence: "Confianza",
    horizon: "Horizonte",
    range: "Rango",
    action: "Accion",
    reason: "Motivo",
    updated: "Actualizado",
    emptyFault: "La IA aun no detecta una falla dominante.",
    emptyPower: "Todavia faltan lecturas para proyectar generacion util.",
    emptyYaw: "Se necesita una direccion de viento mas estable para orientar mejor.",
    emptyVisit: "Aun no se ve una intervencion prioritaria.",
    align: "Alinear con la direccion viva del viento.",
    yawReason: "Recomendacion calculada para el dispositivo activo.",
    watchStatus: "Vigilando",
    readyStatus: "Disponible",
    calmStatus: "Sin urgencia",
  },
  en: {
    heroTitle: "Operational AI",
    heroSubtitle: "Predictions and suggestions to anticipate technical visits.",
    sectionTitle: "Operational AI",
    fault: "Probable fault",
    power: "Forecast",
    yaw: "Yaw target",
    visit: "Next visit",
    monitoring: "Monitoring",
    noForecast: "No useful forecast",
    noYaw: "No recommendation",
    noVisit: "No urgent visit",
    confidence: "Confidence",
    horizon: "Horizon",
    range: "Range",
    action: "Action",
    reason: "Reason",
    updated: "Updated",
    emptyFault: "AI has not identified a dominant fault yet.",
    emptyPower: "More recent readings are needed to project useful generation.",
    emptyYaw: "A steadier wind direction is needed to improve alignment.",
    emptyVisit: "No priority intervention is visible yet.",
    align: "Align with the live wind direction.",
    yawReason: "Recommendation generated for the active device.",
    watchStatus: "Watching",
    readyStatus: "Available",
    calmStatus: "No rush",
  },
  qu: {
    heroTitle: "IA operativa",
    heroSubtitle: "Prediccionkuna hinaspa tecnica watuqta nawpaqman qhawanapaq yuyaykuna.",
    sectionTitle: "IA operativa",
    fault: "Probable falla",
    power: "Pronostico",
    yaw: "Orientacion",
    visit: "Hamuq visita",
    monitoring: "Qhawachkan",
    noForecast: "Mana util pronostico",
    noYaw: "Mana recomendacion",
    noVisit: "Mana utqay visita",
    confidence: "Confianza",
    horizon: "Horizonte",
    range: "Rango",
    action: "Accion",
    reason: "Motivo",
    updated: "Musuqchasqa",
    emptyFault: "IA manaraq huk hatun falla reqsichkanchu.",
    emptyPower: "Aswan recentekuna lecturakuna faltanraq generacionta pronosticaypaq.",
    emptyYaw: "Aswan estable wayra direccion munakun orientacion allinyachinapaq.",
    emptyVisit: "Manaraq prioridad intervencion rikunchu.",
    align: "Kunan wayra direccionwan alineay.",
    yawReason: "Activo dispositivopaq rekomendasqa.",
    watchStatus: "Qhawariy",
    readyStatus: "Kachkan",
    calmStatus: "Mana utqaychu",
  },
  zh: {
    heroTitle: "运营 AI",
    heroSubtitle: "用于提前安排技术巡检的预测与建议。",
    sectionTitle: "运营 AI",
    fault: "可能故障",
    power: "预测",
    yaw: "朝向",
    visit: "下次巡检",
    monitoring: "监测中",
    noForecast: "暂无有效预测",
    noYaw: "暂无建议",
    noVisit: "暂无紧急巡检",
    confidence: "置信度",
    horizon: "时间范围",
    range: "区间",
    action: "建议操作",
    reason: "原因",
    updated: "更新时间",
    emptyFault: "AI 目前还没有识别出主导故障。",
    emptyPower: "仍需更多近期读数才能形成有效发电预测。",
    emptyYaw: "需要更稳定的风向才能给出更好的朝向建议。",
    emptyVisit: "当前还没有明显的优先干预。",
    align: "请与实时风向保持对齐。",
    yawReason: "这是为当前设备计算的建议。",
    watchStatus: "关注中",
    readyStatus: "可用",
    calmStatus: "不紧急",
  },
} as const;

const faultLabels = {
  high_temp: {
    es: "Temperatura alta del inversor",
    en: "High inverter temperature",
    qu: "Temperatura hatun",
    zh: "逆变器温度过高",
  },
  high_vibration: {
    es: "Vibracion alta del motor",
    en: "High motor vibration",
    qu: "Vibracion hatun",
    zh: "电机振动过高",
  },
  low_battery: {
    es: "Reserva de bateria baja",
    en: "Low battery reserve",
    qu: "Bateria pisi",
    zh: "电池储备偏低",
  },
  overload: {
    es: "Riesgo de sobrecarga",
    en: "Overload risk",
    qu: "Sobrecarga peligru",
    zh: "过载风险",
  },
  nominal_operation: {
    es: "Operacion nominal",
    en: "Nominal operation",
    qu: "Allin operacion",
    zh: "正常运行",
  },
} as const;

const humanizeFaultLabel = (language: AppLanguage, label: string | null) => {
  if (!label) return copy[language].monitoring;
  const known = faultLabels[label as keyof typeof faultLabels];
  if (known) return known[language];
  return label
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (token) => token.toUpperCase());
};

const formatNumber = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined || Number.isNaN(value) ? null : Number(value).toFixed(digits);

const formatPower = (value: number | null | undefined) =>
  value === null || value === undefined || Number.isNaN(value)
    ? null
    : `${Number(value).toFixed(value >= 1000 ? 0 : 1)} W`;

const aiLevel = (severity: "info" | "warning" | "critical" | null | undefined) => {
  if (severity === "critical") return "stop" as const;
  if (severity === "warning") return "warn" as const;
  return "ok" as const;
};

const circularDelta = (left: number, right: number) => {
  const diff = Math.abs(left - right) % 360;
  return diff > 180 ? 360 - diff : diff;
};

const withinHoursText = (language: AppLanguage, hours: number) => {
  if (language === "en") return `Within ${hours} h`;
  if (language === "qu") return `${hours} h ukhupi`;
  if (language === "zh") return `${hours} 小时内`;
  return `En ${hours} h`;
};

const buildVisitPlan = (
  language: AppLanguage,
  reading: TelemetryReading | null,
  ai: OperationalAiSnapshot | null,
) => {
  if (!reading || !ai) return null;

  const fault = ai.faultPrediction;
  if (
    fault?.label &&
    fault.label !== "nominal_operation" &&
    (fault.confidencePct ?? 0) >= 60
  ) {
    const label = String(fault.label).toLowerCase();
    const hours =
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

    const reason =
      label === "high_vibration"
        ? language === "en"
          ? "predicted motor vibration growth"
          : language === "qu"
            ? "vibracion wiayta pronostican"
            : language === "zh"
              ? "预计电机振动会继续升高"
              : "crecimiento previsto de vibracion del motor"
        : label === "high_temp"
          ? language === "en"
            ? "predicted inverter thermal stress"
            : language === "qu"
              ? "temperatura estres pronostican"
              : language === "zh"
                ? "预计逆变器热应力增加"
                : "estres termico previsto del inversor"
          : label === "low_battery"
            ? language === "en"
              ? "predicted battery reserve depletion"
              : language === "qu"
                ? "bateria waqcha kay pronostican"
                : language === "zh"
                  ? "预计电池储备继续下降"
                  : "agotamiento previsto de la reserva de bateria"
            : language === "en"
              ? "predicted overload risk"
              : language === "qu"
                ? "sobrecarga peligru pronostican"
                : language === "zh"
                  ? "预计存在过载风险"
                  : "riesgo previsto de sobrecarga";

    return {
      level: aiLevel(fault.severity),
      summary: withinHoursText(language, hours),
      reason,
      action:
        fault.recommendedAction ||
        (language === "en"
          ? "Prepare inspection and probable spare parts before the next demanding cycle."
          : language === "qu"
            ? "Qhawariyta waqaychay hinaspa repuestokunata apay."
            : language === "zh"
              ? "请在下一次高负荷周期前准备检查和可能需要的备件。"
              : "Preparar inspeccion y posibles repuestos antes del siguiente ciclo exigente."),
    };
  }

  const predictedPower = ai.powerForecast?.predictedPowerW ?? null;
  const demandPower = reading.loadPowerW ?? 0;
  const reserve = reading.batteryPct ?? 100;
  if (
    predictedPower !== null &&
    (predictedPower < 280 || (demandPower > 0 && demandPower - predictedPower > 320))
  ) {
    const hours = reserve < 35 ? 12 : 30;
    return {
      level: reserve < 35 ? "warn" as const : "ok" as const,
      summary: withinHoursText(language, hours),
      reason:
        language === "en"
          ? "forecasted generation may fall below demand"
          : language === "qu"
            ? "generacion demanda urayman rinman"
            : language === "zh"
              ? "预测发电量可能低于当前需求"
              : "la generacion prevista puede quedar por debajo de la demanda",
      action:
        language === "en"
          ? "Review wind capture, household load and storage backup strategy."
          : language === "qu"
            ? "Wayra hapiyta, carga wasita, respaldota qhawariy."
            : language === "zh"
              ? "请检查风能获取、住户负载和储能备用策略。"
              : "Revisar captacion de viento, carga de la vivienda y estrategia de respaldo.",
    };
  }

  const yawTarget = ai.yawRecommendation?.targetYawDeg ?? null;
  const windDirection = reading.windDirectionDeg ?? null;
  const yawDelta =
    yawTarget === null || windDirection === null ? null : circularDelta(yawTarget, windDirection);

  if (
    yawTarget !== null &&
    (ai.yawRecommendation?.confidencePct ?? 0) >= 70 &&
    (yawDelta === null || yawDelta >= 18 || Boolean(ai.yawRecommendation?.reason))
  ) {
    const hours = yawDelta !== null && yawDelta >= 35 ? 18 : 48;
    return {
      level: yawDelta !== null && yawDelta >= 35 ? "warn" as const : "ok" as const,
      summary: withinHoursText(language, hours),
      reason:
        ai.yawRecommendation?.reason ||
        (language === "en"
          ? "yaw alignment should be validated in the field"
          : language === "qu"
            ? "yaw alineacion chakra pampapi qhawariy"
            : language === "zh"
              ? "建议在现场核实偏航对准情况"
              : "la orientacion de la gondola conviene validarla en campo"),
      action:
        ai.yawRecommendation?.action ||
        (language === "en"
          ? "Verify nacelle alignment before the next strong-wind window."
          : language === "qu"
            ? "Gondola alineacionta qhawariy manaraq sinchi wayra hamuqtin."
            : language === "zh"
              ? "请在下一次强风窗口前确认机舱对准情况。"
              : "Verificar la alineacion de la gondola antes de la siguiente ventana de viento fuerte."),
    };
  }

  return null;
};

const buildPowerRange = (language: AppLanguage, ai: OperationalAiSnapshot | null) => {
  const lower = formatPower(ai?.powerForecast?.lowerBoundW ?? null);
  const upper = formatPower(ai?.powerForecast?.upperBoundW ?? null);
  if (!lower || !upper) return null;
  return `${copy[language].range}: ${lower} - ${upper}`;
};

export const AiScreen = () => {
  const { language } = useI18n();
  const text = copy[language];
  const { reading, aiOperational } = useAero();
  const visitPlan = buildVisitPlan(language, reading, aiOperational);
  const faultLabel = humanizeFaultLabel(language, aiOperational?.faultPrediction?.label ?? null);
  const faultConfidence = formatNumber(aiOperational?.faultPrediction?.confidencePct ?? null, 0);
  const forecastPower = formatPower(aiOperational?.powerForecast?.predictedPowerW ?? null);
  const forecastHorizon = formatNumber(aiOperational?.powerForecast?.horizonMinutes ?? null, 0);
  const yawDeg = formatNumber(aiOperational?.yawRecommendation?.targetYawDeg ?? null, 0);
  const yawConfidence = formatNumber(aiOperational?.yawRecommendation?.confidencePct ?? null, 0);
  const updatedAt = aiOperational?.updatedAt ?? null;

  return (
    <ScreenLayout>
      <HeroBanner icon="brain" title={text.heroTitle} colors={["#0C5E8D", "#1998D0"]} />

      <Panel
        title={text.sectionTitle}
        subtitle={text.heroSubtitle}
        centerHeaderText
        rightSlot={<MaterialCommunityIcons name="brain" size={22} color={palette.sky700} />}
      >
        <View style={styles.aiStack}>
          <View style={styles.aiCard}>
            <View style={styles.aiHeaderRow}>
              <Text style={styles.aiLabel}>{text.fault}</Text>
              <StatusTag
                level={aiOperational?.faultPrediction ? aiLevel(aiOperational?.faultPrediction?.severity) : "ok"}
                text={aiOperational?.faultPrediction ? faultLabel : text.watchStatus}
              />
            </View>
            <Text style={styles.aiValue}>
              {aiOperational?.faultPrediction ? faultLabel : text.monitoring}
            </Text>
            {faultConfidence ? (
              <Text style={styles.aiMeta}>{text.confidence}: {faultConfidence}%</Text>
            ) : null}
            {aiOperational?.faultPrediction?.recommendedAction ? (
              <Text style={styles.aiMeta}>
                {text.action}: {aiOperational.faultPrediction.recommendedAction}
              </Text>
            ) : (
              <Text style={styles.aiMeta}>{text.emptyFault}</Text>
            )}
          </View>

          <View style={styles.aiCard}>
            <View style={styles.aiHeaderRow}>
              <Text style={styles.aiLabel}>{text.power}</Text>
              <StatusTag
                level={forecastPower ? "ok" : "warn"}
                text={forecastPower ? text.readyStatus : text.watchStatus}
              />
            </View>
            <Text style={styles.aiValue}>{forecastPower || text.noForecast}</Text>
            {forecastHorizon ? (
              <Text style={styles.aiMeta}>{text.horizon}: {forecastHorizon} min</Text>
            ) : null}
            {buildPowerRange(language, aiOperational) ? (
              <Text style={styles.aiMeta}>{buildPowerRange(language, aiOperational)}</Text>
            ) : (
              <Text style={styles.aiMeta}>{text.emptyPower}</Text>
            )}
          </View>

          <View style={styles.aiCard}>
            <View style={styles.aiHeaderRow}>
              <Text style={styles.aiLabel}>{text.yaw}</Text>
              <StatusTag level={yawDeg ? "ok" : "warn"} text={yawDeg ? text.readyStatus : text.watchStatus} />
            </View>
            <Text style={styles.aiValue}>{yawDeg ? `${yawDeg}°` : text.noYaw}</Text>
            {yawConfidence ? (
              <Text style={styles.aiMeta}>{text.confidence}: {yawConfidence}%</Text>
            ) : null}
            <Text style={styles.aiMeta}>
              {aiOperational?.yawRecommendation?.action
                ? `${text.action}: ${aiOperational.yawRecommendation.action}`
                : yawDeg
                  ? text.align
                  : text.emptyYaw}
            </Text>
            {aiOperational?.yawRecommendation?.reason ? (
              <Text style={styles.aiMeta}>{text.reason}: {aiOperational.yawRecommendation.reason}</Text>
            ) : yawDeg ? (
              <Text style={styles.aiMeta}>{text.yawReason}</Text>
            ) : null}
          </View>

          <View style={styles.aiCard}>
            <View style={styles.aiHeaderRow}>
              <Text style={styles.aiLabel}>{text.visit}</Text>
              <StatusTag level={visitPlan?.level || "ok"} text={visitPlan ? text.readyStatus : text.calmStatus} />
            </View>
            <Text style={styles.aiValue}>{visitPlan?.summary || text.noVisit}</Text>
            <Text style={styles.aiMeta}>{visitPlan?.reason || text.emptyVisit}</Text>
            {visitPlan?.action ? (
              <Text style={styles.aiMeta}>{text.action}: {visitPlan.action}</Text>
            ) : null}
          </View>

          {updatedAt ? (
            <View style={styles.footerRow}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={palette.textSoft} />
              <Text style={styles.footerText}>
                {text.updated}: {updatedAt}
              </Text>
            </View>
          ) : null}
        </View>
      </Panel>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  aiStack: {
    width: "100%",
    gap: spacing.md,
  },
  aiCard: {
    width: "100%",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    padding: spacing.md,
    gap: 8,
  },
  aiHeaderRow: {
    width: "100%",
    gap: spacing.sm,
    alignItems: "center",
  },
  aiLabel: {
    color: palette.textSoft,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  aiValue: {
    color: palette.text,
    fontFamily: fonts.titleMedium,
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
  },
  aiMeta: {
    color: palette.textSoft,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  footerRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.xs,
  },
  footerText: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: "center",
  },
});
