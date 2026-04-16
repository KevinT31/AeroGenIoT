import { HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
};

export const Panel = ({ className, elevated = false, ...props }: PanelProps) => (
  <div
    className={cn(
      "glass-panel rounded-3xl border px-5 py-5 shadow-panel transition-colors dark:border-white/10 dark:bg-white/5",
      elevated && "shadow-glow",
      className,
    )}
    {...props}
  />
);
