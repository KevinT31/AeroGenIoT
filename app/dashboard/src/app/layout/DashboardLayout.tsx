import {
  Activity,
  AlertTriangle,
  Clock3,
  Gauge,
  Radar,
  Radio,
  RefreshCw,
  TowerControl,
  Wrench,
  Wind,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useDashboardData } from "@/hooks/useDashboardData";
import { ENV } from "@/config/env";
import { connectivityLabel, timeAgo } from "@/utils/format";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/utils/cn";
import { translateDashboard } from "@/i18n/translations";

const navigation = [
  { to: "/", key: "nav.overview", icon: Gauge },
  { to: "/digital-twin", key: "nav.digitalTwin", icon: Wind },
  { to: "/telemetry", key: "nav.telemetry", icon: Activity },
  { to: "/alarms", key: "nav.alarms", icon: AlertTriangle },
  { to: "/maintenance", key: "nav.maintenance", icon: Wrench },
  { to: "/device", key: "nav.device", icon: Radar },
];

export const DashboardLayout = () => {
  const {
    snapshot,
    isLoading,
    isRealtimeConnected,
    refresh,
    isRefreshing,
    language,
  } = useDashboardData();
  const connectivity = snapshot.health.connectivityStatus;
  const realtimeShort = isRealtimeConnected
    ? language === "es"
      ? "En vivo"
      : "Live"
    : language === "es"
      ? "En espera"
      : "Standby";
  const updatedShort = snapshot.lastUpdatedAt
    ? timeAgo(snapshot.lastUpdatedAt, language)
    : "--";

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1800px] gap-6 px-4 py-4 xl:px-6">
        <aside className="glass-panel scrollbar-thin hidden w-72 self-start flex-col rounded-[32px] border p-5 lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="flex items-center gap-3 border-b border-slate-200/80 pb-5 dark:border-white/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-noctua-500 to-aurora-500 shadow-glow">
              <TowerControl className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-slate-950 dark:text-white">{ENV.appName}</p>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-500">
                {translateDashboard(language, "layout.control")}
              </p>
            </div>
          </div>

          <nav className="mt-6 space-y-2">
            {navigation.map(({ to, key, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition",
                    isActive
                      ? "bg-noctua-500/12 text-noctua-700 dark:bg-noctua-400/12 dark:text-white"
                      : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/6 dark:hover:text-white",
                  )
                }
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                <span>{translateDashboard(language, key)}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 pt-2">
            <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-500">
                {translateDashboard(language, "layout.device")}
              </p>
              <p className="mt-2 font-display text-xl font-semibold text-slate-950 dark:text-white">{ENV.deviceId}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{snapshot.health.generationStatus}</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="glass-panel sticky top-0 z-40 mb-6 rounded-[30px] border px-5 py-4 lg:top-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="xl:shrink-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-500">
                  {translateDashboard(language, "layout.missionControl")}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 xl:flex-nowrap">
                  <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                    {translateDashboard(language, "layout.dashboardTitle")}
                  </h1>
                  <StatusPill
                    className="shrink-0 whitespace-nowrap"
                    tone={
                      connectivity === "live"
                        ? "ok"
                        : connectivity === "stale"
                          ? "warn"
                          : connectivity === "offline"
                            ? "offline"
                            : "critical"
                    }
                  >
                    {connectivityLabel(connectivity, language)}
                  </StatusPill>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 xl:justify-end xl:self-start">
                <div
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300/80 bg-white/90 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                  title={
                    isRealtimeConnected
                      ? translateDashboard(language, "layout.realtimeOnline")
                      : translateDashboard(language, "layout.realtimeStandby")
                  }
                >
                  <Radio className={cn("h-3.5 w-3.5", isRealtimeConnected && "text-signal-ok")} />
                  <span>{realtimeShort}</span>
                </div>
                <div
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300/80 bg-white/90 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                  title={translateDashboard(language, "layout.updated", {
                    time: timeAgo(snapshot.lastUpdatedAt, language),
                  })}
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  <span>{updatedShort}</span>
                </div>
                <LanguageToggle />
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-noctua-700 text-white transition hover:bg-noctua-600 disabled:opacity-50 dark:bg-noctua-500 dark:hover:bg-noctua-400"
                  disabled={isLoading || isRefreshing}
                  aria-label={
                    isRefreshing
                      ? translateDashboard(language, "layout.refreshing")
                      : translateDashboard(language, "layout.refresh")
                  }
                  title={
                    isRefreshing
                      ? translateDashboard(language, "layout.refreshing")
                      : translateDashboard(language, "layout.refresh")
                  }
                >
                  <RefreshCw className={cn("h-4.5 w-4.5", isRefreshing && "animate-spin")} />
                </button>
              </div>
            </div>
          </header>

          <main className="space-y-8 pb-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
