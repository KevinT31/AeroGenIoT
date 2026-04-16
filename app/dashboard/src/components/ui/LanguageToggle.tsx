import { Globe2 } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { translateDashboard } from "@/i18n/translations";

export const LanguageToggle = () => {
  const { language, toggleLanguage } = useDashboardData();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-noctua-400 hover:text-noctua-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-noctua-300 dark:hover:text-white"
      aria-label={translateDashboard(language, "language.label")}
      title={translateDashboard(language, "language.label")}
    >
      <Globe2 className="h-4 w-4" />
      <span>{translateDashboard(language, `language.short.${language}`)}</span>
    </button>
  );
};
