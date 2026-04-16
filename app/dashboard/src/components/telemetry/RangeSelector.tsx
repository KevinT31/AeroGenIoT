import { TimeRange } from "@/types/dashboard";
import { cn } from "@/utils/cn";

const options: TimeRange[] = ["1h", "6h", "24h", "7d"];

export const RangeSelector = ({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}) => (
  <div className="inline-flex rounded-full border border-slate-300/80 bg-white/80 p-1 dark:border-white/10 dark:bg-white/5">
    {options.map((option) => (
      <button
        key={option}
        type="button"
        onClick={() => onChange(option)}
        className={cn(
          "rounded-full px-3 py-1.5 text-sm font-medium transition",
          value === option
            ? "bg-noctua-700 text-white dark:bg-noctua-500"
            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
        )}
      >
        {option}
      </button>
    ))}
  </div>
);
