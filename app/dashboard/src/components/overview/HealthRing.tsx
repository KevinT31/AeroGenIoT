import { useId } from "react";
import { cn } from "@/utils/cn";

export const HealthRing = ({ score, label }: { score: number; label: string }) => {
  const percentage = Math.max(0, Math.min(100, score));
  const gradientId = useId().replace(/:/g, "");
  const tone =
    percentage >= 80
      ? {
          start: "#34d399",
          end: "#2dd4bf",
          track: "stroke-emerald-200/70 dark:stroke-emerald-400/15",
          glow: "from-emerald-300/30 via-teal-300/18 to-transparent",
          chip: "border-emerald-200/90 bg-emerald-50/95 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
          marker: "#34d399",
          shadow: "drop-shadow-[0_0_20px_rgba(52,211,153,0.34)]",
        }
      : percentage >= 60
        ? {
            start: "#fbbf24",
            end: "#fb923c",
            track: "stroke-amber-200/80 dark:stroke-amber-300/15",
            glow: "from-amber-200/35 via-orange-300/16 to-transparent",
            chip: "border-amber-200/90 bg-amber-50/95 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
            marker: "#f59e0b",
            shadow: "drop-shadow-[0_0_20px_rgba(245,158,11,0.34)]",
          }
      : {
            start: "#fb7185",
            end: "#fb7185",
            track: "stroke-rose-200/80 dark:stroke-rose-300/15",
            glow: "from-rose-200/35 via-pink-300/16 to-transparent",
            chip: "border-rose-200/90 bg-rose-50/95 text-rose-600 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300",
            marker: "#fb7185",
            shadow: "drop-shadow-[0_0_20px_rgba(251,113,133,0.34)]",
          };
  const radius = 88;
  const strokeWidth = 18;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const dashOffset = circumference * (1 - percentage / 100);
  const angle = percentage / 100 * Math.PI * 2 - Math.PI / 2;
  const markerX = 110 + Math.cos(angle) * normalizedRadius;
  const markerY = 110 + Math.sin(angle) * normalizedRadius;

  return (
    <div className="relative flex aspect-square w-[17.5rem] max-w-full items-center justify-center sm:w-[19rem] xl:w-[20.5rem]">
      <div className={cn("absolute inset-3 rounded-full bg-gradient-to-br blur-[70px] dark:opacity-80", tone.glow)} />
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.9)_52%,rgba(247,250,255,0.72)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] dark:bg-[radial-gradient(circle_at_center,rgba(25,34,51,0.96)_0%,rgba(17,24,39,0.92)_58%,rgba(9,15,28,0.78)_100%)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" />
      <div className="absolute inset-2 rounded-full border border-white/60 dark:border-slate-700/70" />
      <svg viewBox="0 0 220 220" className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={tone.start} />
            <stop offset="100%" stopColor={tone.end} />
          </linearGradient>
        </defs>
        <circle
          cx="110"
          cy="110"
          r={normalizedRadius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn("transition-colors duration-300", tone.track)}
        />
        <circle
          cx="110"
          cy="110"
          r={normalizedRadius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke={`url(#${gradientId})`}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={cn("transition-all duration-500", tone.shadow)}
        />
        <circle
          cx="110"
          cy="110"
          r={98}
          fill="none"
          strokeWidth="1"
          className="stroke-white/60 dark:stroke-slate-600/55"
        />
        <circle
          cx="110"
          cy="110"
          r={56}
          fill="none"
          strokeWidth="1"
          className="stroke-slate-200/80 dark:stroke-slate-700/80"
        />
        <circle
          cx={markerX}
          cy={markerY}
          r="8.5"
          fill={tone.marker}
          className="drop-shadow-[0_0_14px_rgba(255,255,255,0.7)] dark:drop-shadow-[0_0_18px_rgba(251,113,133,0.4)]"
        />
        <circle
          cx={markerX}
          cy={markerY}
          r="3.25"
          fill="#ffffff"
          opacity="0.95"
        />
      </svg>
      <div className="absolute inset-[2.35rem] rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,1)_0%,rgba(255,255,255,0.98)_38%,rgba(248,250,255,0.94)_100%)] shadow-[0_22px_56px_rgba(15,23,42,0.1)] dark:bg-[radial-gradient(circle_at_top,rgba(34,45,67,0.98)_0%,rgba(22,31,47,0.97)_42%,rgba(11,18,31,0.95)_100%)] dark:shadow-[0_24px_56px_rgba(2,6,23,0.42)]" />
      <div className="absolute inset-[3.2rem] rounded-full border border-slate-100/80 dark:border-slate-700/60" />
      <div className="relative flex flex-col items-center justify-center text-center">
        <div className="font-display text-[4.3rem] font-semibold leading-none tracking-tight text-slate-950 [text-shadow:0_10px_28px_rgba(15,23,42,0.08)] dark:text-white dark:[text-shadow:0_12px_28px_rgba(0,0,0,0.36)]">
          {percentage}
        </div>
        <div
          className={cn(
            "mt-4 rounded-full border px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.28em] shadow-[0_10px_24px_rgba(15,23,42,0.06)]",
            tone.chip,
          )}
        >
          {label}
        </div>
      </div>
    </div>
  );
};
