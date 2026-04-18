import { Gauge, Sparkles, TriangleAlert, Wind } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { DashboardLanguage, translateDashboard } from "@/i18n/translations";
import { AiOperationalSnapshot } from "@/types/dashboard";
import { Panel } from "@/components/ui/Panel";
import { cn } from "@/utils/cn";

const copy = {
  en: {
    eyebrow: "AI LAYER",
    title: "Operational predictions",
    subtitle: "Live readback from the MySQL prediction tables.",
    fault: "Probable fault",
    power: "Power forecast",
    yaw: "Yaw target",
    noData: "No prediction",
    confidence: "Confidence",
    horizon: "Horizon",
    range: "Range",
    action: "Action",
    reason: "Reason",
    degrees: "deg",
    minutes: "min",
    align: "Align nacelle to live wind direction.",
    yawReason: "Recommendation generated for the active device.",
    updated: "Updated from AI tables",
  },
  es: {
    eyebrow: "CAPA IA",
    title: "Predicciones operativas",
    subtitle: "Lectura viva desde las tablas de prediccion en MySQL.",
    fault: "Falla probable",
    power: "Pronostico de potencia",
    yaw: "Objetivo de orientacion",
    noData: "Sin prediccion",
    confidence: "Confianza",
    horizon: "Horizonte",
    range: "Rango",
    action: "Accion",
    reason: "Motivo",
    degrees: "gr",
    minutes: "min",
    align: "Alinear la gondola con la direccion viva del viento.",
    yawReason: "Recomendacion generada para el dispositivo activo.",
    updated: "Actualizado desde tablas IA",
  },
  qu: {
    eyebrow: "IA KAPA",
    title: "Operativa prediccionkuna",
    subtitle: "MySQL prediccion tablankunamanta kawsay ñawinchay.",
    fault: "Probable falla",
    power: "Potencia pronostico",
    yaw: "Orientacion objetivo",
    noData: "Mana prediccion",
    confidence: "Confianza",
    horizon: "Horizonte",
    range: "Rango",
    action: "Accion",
    reason: "Motivo",
    degrees: "gr",
    minutes: "min",
    align: "Gondolata kawsay wayra direccionwan alineay.",
    yawReason: "Activo dispositivopaq rekomendasqa.",
    updated: "IA tablankunamanta musuqchasqa",
  },
  zh: {
    eyebrow: "AI 层",
    title: "运行预测",
    subtitle: "从 MySQL 预测表读取实时结果。",
    fault: "可能故障",
    power: "功率预测",
    yaw: "偏航目标",
    noData: "暂无预测",
    confidence: "置信度",
    horizon: "预测范围",
    range: "区间",
    action: "建议操作",
    reason: "原因",
    degrees: "度",
    minutes: "分钟",
    align: "使机舱与实时风向对齐。",
    yawReason: "这是为当前设备生成的建议。",
    updated: "已从 AI 表更新",
  },
} as const;

const severityTone = {
  critical: "bg-signal-danger/10 text-signal-danger",
  warning: "bg-signal-warn/10 text-signal-warn",
  info: "bg-signal-info/10 text-signal-info",
} as const;

const faultLabels = {
  high_temp: { en: "High inverter temperature", es: "Temperatura alta del inversor", qu: "Inversorpi alta temperatura", zh: "逆变器温度过高" },
  high_vibration: { en: "High motor vibration", es: "Vibracion alta del motor", qu: "Motorpi alta vibracion", zh: "电机振动过高" },
  low_battery: { en: "Low battery reserve", es: "Reserva de bateria baja", qu: "Bateria reserva pisi", zh: "电池储备偏低" },
  overload: { en: "Overload risk", es: "Riesgo de sobrecarga", qu: "Sobrecarga riesgo", zh: "过载风险" },
  nominal_operation: { en: "Nominal operation", es: "Operacion nominal", qu: "Normal operacion", zh: "正常运行" },
} as const;

const humanizeFaultLabel = (language: DashboardLanguage, label: string | null) => {
  if (!label) return copy[language].noData;
  const known = faultLabels[label as keyof typeof faultLabels];
  if (known) return known[language];
  return label
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (token) => token.toUpperCase());
};

const formatNumber = (value: number | null, digits = 0) =>
  value === null || value === undefined || Number.isNaN(value)
    ? "--"
    : Number(value).toFixed(digits);

const formatPower = (value: number | null) =>
  value === null || value === undefined || Number.isNaN(value)
    ? "--"
    : `${Number(value).toFixed(value >= 1000 ? 0 : 1)} W`;

export const OperationalAiPanel = ({ ai }: { ai: AiOperationalSnapshot | null }) => {
  const { language } = useDashboardData();
  const text = copy[language];
  const powerLower = ai?.powerForecast?.lowerBoundW ?? null;
  const powerUpper = ai?.powerForecast?.upperBoundW ?? null;
  const yawTarget = ai?.yawRecommendation?.targetYawDeg ?? null;

  const cards = [
    {
      key: "fault",
      icon: TriangleAlert,
      title: text.fault,
      accent: "from-signal-danger/18 to-rose-400/8",
      value: humanizeFaultLabel(language, ai?.faultPrediction?.label ?? null),
      lines: [
        `${text.confidence}: ${formatNumber(ai?.faultPrediction?.confidencePct ?? null, 0)}%`,
        ai?.faultPrediction?.recommendedAction
          ? `${text.action}: ${ai.faultPrediction.recommendedAction}`
          : null,
      ].filter(Boolean) as string[],
      badge: ai?.faultPrediction?.severity ?? "info",
    },
    {
      key: "power",
      icon: Gauge,
      title: text.power,
      accent: "from-signal-info/18 to-aurora-400/8",
      value: formatPower(ai?.powerForecast?.predictedPowerW ?? null),
      lines: [
        `${text.horizon}: ${formatNumber(ai?.powerForecast?.horizonMinutes ?? null, 0)} ${text.minutes}`,
        powerLower !== null && powerUpper !== null
          ? `${text.range}: ${formatPower(powerLower)} - ${formatPower(powerUpper)}`
          : null,
      ].filter(Boolean) as string[],
      badge: "info" as const,
    },
    {
      key: "yaw",
      icon: Wind,
      title: text.yaw,
      accent: "from-signal-ok/18 to-emerald-400/8",
      value:
        yawTarget === null
          ? copy[language].noData
          : `${formatNumber(yawTarget, 0)} ${text.degrees}`,
      lines: [
        ai?.yawRecommendation?.action ? `${text.action}: ${ai.yawRecommendation.action}` : text.align,
        ai?.yawRecommendation?.reason ? `${text.reason}: ${ai.yawRecommendation.reason}` : text.yawReason,
      ],
      badge: "info" as const,
    },
  ];

  return (
    <Panel className="relative overflow-hidden p-0">
      <div className="absolute inset-0 bg-gradient-to-br from-aurora-500/12 via-white/0 to-noctua-500/8 dark:from-aurora-500/10 dark:via-transparent dark:to-noctua-500/12" />
      <div className="relative flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-signal-info">
              {text.eyebrow}
            </div>
            <h3 className="mt-2 font-display text-2xl font-semibold text-slate-950 dark:text-white">
              {text.title}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{text.subtitle}</p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-300/60 bg-emerald-100/70 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Sparkles className="h-4 w-4" />
            {text.updated}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.key}
                className={cn(
                  "rounded-[26px] border border-slate-300/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-black/20",
                  "relative overflow-hidden",
                )}
              >
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-80", card.accent)} />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-2xl border border-slate-300/70 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
                      <Icon className="h-5 w-5 text-slate-900 dark:text-white" />
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]", severityTone[card.badge])}>
                      {translateDashboard(language, `alarm.severity.${card.badge}`)}
                    </span>
                  </div>
                  <div className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-500">
                    {card.title}
                  </div>
                  <div className="mt-2 font-display text-2xl font-semibold text-slate-950 dark:text-white">
                    {card.value}
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {card.lines.map((line) => (
                      <p key={line} className="leading-6">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
};
