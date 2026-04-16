import { ReactNode } from "react";
import { cn } from "@/utils/cn";

type Tone = "ok" | "warn" | "critical" | "info" | "offline";

const styles: Record<Tone, string> = {
  ok: "border-signal-ok/25 bg-signal-ok/10 text-signal-ok",
  warn: "border-signal-warn/25 bg-signal-warn/10 text-signal-warn",
  critical: "border-signal-danger/25 bg-signal-danger/10 text-signal-danger",
  info: "border-signal-info/25 bg-signal-info/10 text-signal-info",
  offline: "border-slate-400/25 bg-slate-500/10 text-slate-400",
};

export const StatusPill = ({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium tracking-wide",
      styles[tone],
      className,
    )}
  >
    <span className="h-2 w-2 rounded-full bg-current opacity-80" />
    {children}
  </span>
);
