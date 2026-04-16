import { ReactNode } from "react";

export const SectionHeader = ({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) => {
  const hasEyebrow = Boolean(eyebrow?.trim());
  const hasDescription = Boolean(description?.trim());

  return (
  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
    <div className="space-y-1">
      {hasEyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.24em] text-noctua-500 dark:text-noctua-300">{eyebrow}</p> : null}
      <h2 className="font-display text-2xl font-semibold text-slate-950 dark:text-white">{title}</h2>
      {hasDescription ? <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">{description}</p> : null}
    </div>
    {action ? <div className="flex items-center gap-3">{action}</div> : null}
  </div>
  );
};
