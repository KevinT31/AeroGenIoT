import { MoonStar, SunMedium } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { translateDashboard } from "@/i18n/translations";

export const ThemeToggle = () => {
  const { themeMode, toggleTheme, language } = useDashboardData();
  const label =
    themeMode === "dark"
      ? translateDashboard(language, "theme.light")
      : translateDashboard(language, "theme.dark");

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300/80 bg-white/90 text-slate-700 transition hover:border-noctua-400 hover:text-noctua-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-noctua-300 dark:hover:text-white"
      aria-label={label}
      title={label}
    >
      {themeMode === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
    </button>
  );
};
