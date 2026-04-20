import { CalendarClock, ShieldAlert, Sparkles, Wrench } from "lucide-react";
import { MaintenanceCategory, MaintenanceItem } from "@/types/dashboard";
import { Panel } from "@/components/ui/Panel";
import { cn } from "@/utils/cn";
import { formatDateTime } from "@/utils/format";
import { translateDashboard } from "@/i18n/translations";
import { useDashboardData } from "@/hooks/useDashboardData";

const meta = {
  corrective: { icon: ShieldAlert, accent: "from-signal-danger/22 to-rose-400/10", title: "Corrective" },
  preventive: { icon: CalendarClock, accent: "from-signal-info/22 to-noctua-400/10", title: "Preventive" },
  predictive: { icon: Sparkles, accent: "from-aurora-500/22 to-noctua-500/10", title: "Predictive" },
};

const priorityTone = {
  critical: "bg-signal-danger/10 text-signal-danger",
  high: "bg-signal-warn/10 text-signal-warn",
  medium: "bg-signal-info/10 text-signal-info",
  low: "bg-slate-500/10 text-slate-500",
};

const statusTone = {
  new: "bg-slate-500/10 text-slate-600",
  scheduled: "bg-signal-info/10 text-signal-info",
  in_progress: "bg-signal-warn/10 text-signal-warn",
  resolved: "bg-signal-ok/10 text-signal-ok",
};

export const MaintenanceLane = ({
  category,
  items,
}: {
  category: MaintenanceCategory;
  items: MaintenanceItem[];
}) => {
  const { language } = useDashboardData();
  const lane = meta[category];
  const Icon = lane.icon;

  return (
    <Panel className="relative overflow-hidden p-0">
      <div className={cn("absolute inset-0 bg-gradient-to-br", lane.accent)} />
      <div className="relative flex h-full flex-col p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl border border-slate-300/70 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
            <Icon className="h-5 w-5 text-slate-900 dark:text-white" />
          </div>
          <div>
            <h3 className="font-display text-xl font-semibold text-slate-950 dark:text-white">
              {translateDashboard(language, `maintenance.${category}`)}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {translateDashboard(language, "maintenance.queueCount", {
                count: items.length,
              })}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {items.length ? (
            items.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-300/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-black/20">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                      <Wrench className="h-3.5 w-3.5" />
                      {componentLabel(item.component, language)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]", priorityTone[item.priority])}>
                        {translateDashboard(language, `maintenance.priority.${item.priority}`)}
                      </span>
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]", statusTone[item.status])}>
                        {translateDashboard(language, `maintenance.status.${item.status}`)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-display text-lg font-semibold text-slate-950 dark:text-white">{item.title}</h4>
                    <p className="max-w-none text-sm leading-8 text-slate-600 dark:text-slate-400">{item.description}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-4 rounded-2xl border border-slate-200/70 bg-slate-50/75 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-black/15 dark:text-slate-300">
                  <div className="space-y-1.5">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {translateDashboard(language, "maintenance.trigger")}:
                    </div>
                    <div className="leading-7">{ruleLabel(item.sourceRule, language)}</div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {translateDashboard(language, "maintenance.executionPlan")}:
                    </div>
                    <div className="leading-7">{translateDashboard(language, `maintenance.plan.${item.category}`)}</div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {translateDashboard(language, "maintenance.recommendedAction")}:
                    </div>
                    <div className="leading-7">{item.recommendedAction}</div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {translateDashboard(language, "maintenance.closeCriteria")}:
                    </div>
                    <div className="leading-7">{translateDashboard(language, `maintenance.close.${item.category}`)}</div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {translateDashboard(language, "maintenance.nextCheckpoint")}:
                    </div>
                    <div className="leading-7">{formatDateTime(item.dueDate, language)}</div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-slate-300/80 bg-white/85 px-4 py-6 text-sm text-slate-600 dark:border-white/10 dark:bg-black/20 dark:text-slate-400">
              {translateDashboard(language, "maintenance.none")}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
};

const ruleLabel = (sourceRule: string, language: ReturnType<typeof useDashboardData>["language"]) => {
  const normalizedRule =
    sourceRule === "thermal-threshold-crossed"
      ? "temp-above-threshold"
      : sourceRule;

  const key = `maintenance.rule.${normalizedRule}`;
  const translated = translateDashboard(language, key);
  if (translated === key) return sourceRule;
  return translated;
};

const componentLabel = (
  component: string,
  language: ReturnType<typeof useDashboardData>["language"],
) => {
  const normalized = component.trim().toLowerCase();

  const key =
    normalized === "electrical system"
      ? "maintenance.component.electrical_system"
      : normalized === "inverter and rotor support"
        ? "maintenance.component.inverter_rotor_support"
        : normalized === "inverter / controller"
          ? "maintenance.component.inverter_controller"
          : normalized === "rotor"
            ? "maintenance.component.rotor"
            : normalized === "generator"
              ? "maintenance.component.generator"
              : normalized === "inverter"
                ? "maintenance.component.inverter"
                : normalized === "battery"
                  ? "maintenance.component.battery"
                  : normalized === "power stage"
                    ? "maintenance.component.power_stage"
                    : normalized === "wind capture and reserve"
                      ? "maintenance.component.wind_capture_reserve"
                      : normalized === "yaw alignment"
                        ? "maintenance.component.yaw_alignment"
                        : null;

  if (!key) return component;

  const translated = translateDashboard(language, key);
  return translated === key ? component : translated;
};
