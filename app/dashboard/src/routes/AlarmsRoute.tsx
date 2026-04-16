import { useMemo, useState } from "react";
import { AlarmCard } from "@/components/alarms/AlarmCard";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useDashboardData } from "@/hooks/useDashboardData";
import { DashboardLanguage } from "@/i18n/translations";
import { translateDashboard } from "@/i18n/translations";

export const AlarmsRoute = () => {
  const { snapshot, acknowledgeAlarm, language } = useDashboardData();
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "acknowledged" | "resolved">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const alarmTypes = Array.from(new Set(snapshot.alarms.map((alarm) => alarm.type)));
  const filtered = useMemo(
    () =>
      snapshot.alarms.filter((alarm) => {
        if (severityFilter !== "all" && alarm.severity !== severityFilter) return false;
        if (statusFilter !== "all" && alarm.status !== statusFilter) return false;
        if (typeFilter !== "all" && alarm.type !== typeFilter) return false;
        return true;
      }),
    [severityFilter, snapshot.alarms, statusFilter, typeFilter],
  );
  const severityOptions = [
    { value: "all", label: translateDashboard(language, "alarms.filter.all") },
    { value: "critical", label: translateDashboard(language, "alarms.filter.critical") },
    { value: "warning", label: translateDashboard(language, "alarms.filter.warning") },
    { value: "info", label: translateDashboard(language, "alarms.filter.info") },
  ];
  const statusOptions = [
    { value: "all", label: translateDashboard(language, "alarms.filter.all") },
    { value: "open", label: translateDashboard(language, "alarms.filter.open") },
    { value: "acknowledged", label: translateDashboard(language, "alarms.filter.acknowledged") },
    { value: "resolved", label: translateDashboard(language, "alarms.filter.resolved") },
  ];
  const typeOptions = [
    { value: "all", label: translateDashboard(language, "alarms.filter.allTypes") },
    ...alarmTypes.map((type) => ({ value: type, label: alarmTypeLabel(type, language) })),
  ];

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={translateDashboard(language, "alarms.eyebrow")}
        title={translateDashboard(language, "alarms.title")}
      />

      <Panel>
        <div className="grid gap-4 lg:grid-cols-3">
          <FilterSelect label={translateDashboard(language, "alarms.severity")} value={severityFilter} onChange={(value) => setSeverityFilter(value as "all" | "critical" | "warning" | "info")} options={severityOptions} />
          <FilterSelect label={translateDashboard(language, "alarms.status")} value={statusFilter} onChange={(value) => setStatusFilter(value as "all" | "open" | "acknowledged" | "resolved")} options={statusOptions} />
          <FilterSelect label={translateDashboard(language, "alarms.type")} value={typeFilter} onChange={setTypeFilter} options={typeOptions} />
        </div>
      </Panel>

      <div className="space-y-4">
        {filtered.length ? (
          filtered.map((alarm) => <AlarmCard key={alarm.id} alarm={alarm} onAcknowledge={acknowledgeAlarm} languageOverride={language} />)
        ) : (
          <Panel className="text-sm text-slate-600 dark:text-slate-400">
            {translateDashboard(language, "alarms.noneMatch")}
          </Panel>
        )}
      </div>
    </div>
  );
};

const FilterSelect = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) => (
  <label className="space-y-2">
    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border border-slate-300/80 bg-white/90 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-noctua-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const alarmTypeLabel = (type: string, language: DashboardLanguage) => {
  const key = `alarm.title.${type}`;
  const translated = translateDashboard(language, key);
  if (translated !== key) return translated;
  return type.replace(/_/g, " ");
};
