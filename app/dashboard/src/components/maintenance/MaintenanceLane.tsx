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
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                      <Wrench className="h-3.5 w-3.5" />
                      {item.component}
                    </div>
                    <h4 className="mt-2 font-display text-lg font-semibold text-slate-950 dark:text-white">{item.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{item.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]", priorityTone[item.priority])}>
                      {item.priority}
                    </span>
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]", statusTone[item.status])}>
                      {translateDashboard(language, `maintenance.status.${item.status}`)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/75 p-3 text-sm text-slate-600 dark:border-white/10 dark:bg-black/15 dark:text-slate-300">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {translateDashboard(language, "maintenance.trigger")}:
                    </span>{" "}
                    {ruleLabel(item.sourceRule, language)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {translateDashboard(language, "maintenance.executionPlan")}:
                    </span>{" "}
                    {translateDashboard(language, `maintenance.plan.${item.category}`)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {translateDashboard(language, "maintenance.recommendedAction")}:
                    </span>{" "}
                    {item.recommendedAction}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {translateDashboard(language, "maintenance.closeCriteria")}:
                    </span>{" "}
                    {translateDashboard(language, `maintenance.close.${item.category}`)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {translateDashboard(language, "maintenance.nextCheckpoint")}:
                    </span>{" "}
                    {formatDateTime(item.dueDate, language)}
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
  const key = `maintenance.rule.${sourceRule}`;
  const translated = translateDashboard(language, key);
  if (translated === key) return sourceRule;
  return translated;
};
