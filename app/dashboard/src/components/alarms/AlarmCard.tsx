import { AlertTriangle, CheckCircle2, Info, Siren, TriangleAlert } from "lucide-react";
import { AlarmItem } from "@/types/dashboard";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/utils/cn";
import { formatDateTime, timeAgo } from "@/utils/format";
import { translateDashboard } from "@/i18n/translations";
import { useDashboardData } from "@/hooks/useDashboardData";
import type { DashboardLanguage } from "@/i18n/translations";

const iconBySeverity = {
  critical: Siren,
  warning: TriangleAlert,
  info: Info,
};

const toneBySeverity = {
  critical: "critical" as const,
  warning: "warn" as const,
  info: "info" as const,
};

const keepIconLeftByType = new Set([
  "soc_low",
  "battery_low",
  "low_wind",
  "inverter_temp_high",
  "vibration_high",
]);

export const AlarmCard = ({
  alarm,
  compact = false,
  onAcknowledge,
  languageOverride,
}: {
  alarm: AlarmItem;
  compact?: boolean;
  onAcknowledge?: (alarmId: string) => void;
  languageOverride?: DashboardLanguage;
}) => {
  const { language } = useDashboardData();
  const lang = languageOverride ?? language;
  const Icon = iconBySeverity[alarm.severity];
  const severityLabel = translateDashboard(lang, `alarm.severity.${alarm.severity}`);
  const statusLabel = translateDashboard(lang, `alarm.status.${alarm.status}`);
  const alarmTypeKey = `alarm.title.${alarm.type}`;
  const alarmTypeLabel =
    translateDashboard(lang, alarmTypeKey) === alarmTypeKey
      ? alarm.type.replace(/_/g, " ")
      : translateDashboard(lang, alarmTypeKey);
  const keepIconLeft = keepIconLeftByType.has(alarm.type);
  const titleBlock = (
    <div className="min-w-0 flex-1">
      <h3 className="font-display text-lg font-semibold text-slate-950 dark:text-white">{alarm.title}</h3>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">{alarmTypeLabel}</p>
    </div>
  );
  const iconBlock = (
    <div className="shrink-0 rounded-2xl border border-slate-300/80 bg-white/80 p-2.5 dark:border-white/10 dark:bg-white/5">
      <Icon className="h-4.5 w-4.5 text-slate-900 dark:text-white" />
    </div>
  );

  return (
    <Panel
      className={cn(
        "border-l-4 p-4",
        alarm.severity === "critical"
          ? "border-l-signal-danger"
          : alarm.severity === "warning"
            ? "border-l-signal-warn"
            : "border-l-signal-info",
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            {keepIconLeft ? iconBlock : null}
            {titleBlock}
            {!keepIconLeft ? iconBlock : null}
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">{alarm.description}</p>

          {!compact ? (
            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-white">{translateDashboard(lang, "alarm.suggestedAction")}:</span> {alarm.suggestedAction}
            </div>
          ) : null}
        </div>

        <div className="flex min-w-[230px] flex-col items-start gap-3 md:items-end">
          <StatusPill tone={toneBySeverity[alarm.severity]}>{severityLabel}</StatusPill>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <div>{formatDateTime(alarm.timestamp, language)}</div>
            <div className="mt-1">{timeAgo(alarm.timestamp, language)}</div>
          </div>
          <div className="rounded-full border border-slate-300/80 bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            {statusLabel}
          </div>

          {onAcknowledge && alarm.status === "open" && !alarm.id.startsWith("derived:") ? (
            <button
              type="button"
              onClick={() => onAcknowledge(alarm.id)}
              className="inline-flex items-center gap-2 rounded-full bg-noctua-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-noctua-600 dark:bg-noctua-500 dark:hover:bg-noctua-400"
            >
              <CheckCircle2 className="h-4 w-4" />
              {translateDashboard(lang, "alarm.ack")}
            </button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
};
