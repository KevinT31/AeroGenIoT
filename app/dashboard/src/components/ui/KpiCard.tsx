import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { Panel } from "./Panel";
import { cn } from "@/utils/cn";

export const KpiCard = ({
  icon: Icon,
  label,
  value,
  helper,
  delta,
  trend = "up",
  accent = "from-noctua-500/18 to-aurora-500/10",
  footer,
  compact = false,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  helper?: string;
  delta?: string;
  trend?: "up" | "down";
  accent?: string;
  footer?: ReactNode;
  compact?: boolean;
}) => (
  <Panel className="relative overflow-hidden p-0">
    <div className={cn("absolute inset-0 bg-gradient-to-br opacity-100", accent)} />
    <div className={cn("relative flex h-full flex-col p-5", compact ? "gap-3" : "gap-4")}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-2xl border border-white/10 bg-slate-950/10 p-3 dark:bg-white/10">
          <Icon className="h-5 w-5 text-noctua-700 dark:text-noctua-300" />
        </div>
        {delta ? (
          <div
            className={cn(
              "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-medium leading-5",
              trend === "up"
                ? "border-signal-ok/20 bg-signal-ok/10 text-signal-ok"
                : "border-signal-danger/20 bg-signal-danger/10 text-signal-danger",
            )}
          >
            {delta}
          </div>
        ) : null}
      </div>

      <div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</p>
        <div className={cn("mt-2 font-display font-semibold tracking-tight text-slate-950 dark:text-white", compact ? "text-[2rem]" : "text-3xl")}>{value}</div>
      </div>

      {helper ? (
        <p
          className={cn(
            "text-slate-600 dark:text-slate-400",
            compact
              ? "text-xs leading-5 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden"
              : "text-sm",
          )}
        >
          {helper}
        </p>
      ) : null}
      {footer ? <div className="mt-auto">{footer}</div> : null}
    </div>
  </Panel>
);
