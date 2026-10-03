import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Battery,
  Box,
  Compass,
  Eye,
  Gauge,
  Home,
  Pause,
  Play,
  RotateCw,
  Thermometer,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { translateDashboard } from "@/i18n/translations";
import { StatusPill } from "@/components/ui/StatusPill";
import { connectivityLabel, formatNumber, timeAgo } from "@/utils/format";
import { cn } from "@/utils/cn";
import { Twin3DScene, ViewPreset } from "@/components/twin3d/Twin3DScene";
import { buildTwinSceneModel, STATE_COLORS, TwinPartId } from "@/components/twin3d/twinSceneModel";

const PART_LABEL_KEYS: Record<TwinPartId, string> = {
  rotor: "twin3d.part.rotor",
  nacelle: "twin3d.part.nacelle",
  tower: "twin3d.part.tower",
  vane: "twin3d.part.vane",
  controller: "twin3d.part.controller",
  battery: "twin3d.part.battery",
  inverter: "twin3d.part.inverter",
  house: "twin3d.part.house",
};

// Theme-aware HUD chrome — light glass by day, dark glass by night (matches the dashboard panels).
const hudButton =
  "inline-flex items-center gap-1.5 rounded-full glass-panel px-3 py-2 text-xs font-medium text-slate-700 transition hover:text-slate-950 dark:text-slate-200 dark:hover:text-white";
const hudButtonActive = "ring-1 ring-aurora-400/50 text-noctua-600 dark:text-aurora-300";
const surfaceCard = "rounded-2xl border border-slate-200/70 bg-white/60 dark:border-white/10 dark:bg-white/5";

type MetricRow = { icon: React.ComponentType<{ className?: string }>; label: string; value: string };

export const Twin3DRoute = () => {
  const { snapshot, language, themeMode } = useDashboardData();
  const [view, setView] = useState<ViewPreset>("orbit");
  const [viewNonce, setViewNonce] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<TwinPartId | null>(null);
  const [hovered, setHovered] = useState<TwinPartId | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const model = useMemo(() => buildTwinSceneModel(snapshot), [snapshot]);
  const t = (key: string, params?: Record<string, string | number>) => translateDashboard(language, key, params);
  const latest = snapshot.latest;

  const applyView = (preset: ViewPreset) => {
    setView(preset);
    setViewNonce((nonce) => nonce + 1);
    if (preset !== "orbit") setAutoRotate(false);
  };

  const metrics: MetricRow[] = [
    { icon: Wind, label: t("twin3d.metric.wind"), value: `${formatNumber(latest?.windSpeedMs)} m/s` },
    { icon: Compass, label: t("twin3d.metric.windDir"), value: latest?.windDirectionDeg != null ? `${Math.round(latest.windDirectionDeg)}°` : "--" },
    { icon: Gauge, label: t("twin3d.metric.rotor"), value: `${formatNumber(latest?.rotorRpm, 0)} RPM` },
    { icon: Waves, label: t("twin3d.metric.vibration"), value: formatNumber(latest?.vibrationRms, 2) },
    { icon: Thermometer, label: t("twin3d.metric.temp"), value: `${formatNumber(latest?.genTempC)} °C` },
    { icon: Battery, label: t("twin3d.metric.battery"), value: latest?.batteryPct != null ? `${Math.round(latest.batteryPct)}%` : "--" },
    { icon: Zap, label: t("twin3d.metric.output"), value: `${formatNumber(latest?.outputVoltageAcV, 0)} V / ${formatNumber(latest?.outputCurrentAcA, 1)} A` },
    { icon: Home, label: t("twin3d.metric.house"), value: `${formatNumber(latest?.loadPowerW, 0)} W` },
  ];

  const openAlarms = snapshot.alarms.filter((alarm) => alarm.status === "open").slice(0, 4);
  const ai = snapshot.ai;
  const activePart = selected ?? hovered;

  return (
    <div className="fixed inset-0 z-40 bg-slate-100 dark:bg-noctua-950">
      {/* 3D scene: full-bleed */}
      <div className="absolute inset-0">
        <Twin3DScene
          model={model}
          dark={themeMode === "dark"}
          paused={paused}
          autoRotate={autoRotate}
          view={view}
          viewNonce={viewNonce}
          selected={selected}
          onSelect={setSelected}
          onHover={setHovered}
        />
      </div>

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <Link to="/digital-twin" className={hudButton} aria-label={t("twin3d.back")}>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("twin3d.back")}</span>
          </Link>
          <div className="rounded-full glass-panel px-4 py-2">
            <p className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Aurora Noctua <span className="text-noctua-500 dark:text-aurora-400">Twin 3D</span>
            </p>
          </div>
          <StatusPill
            className="pointer-events-auto"
            tone={
              snapshot.health.connectivityStatus === "live"
                ? "ok"
                : snapshot.health.connectivityStatus === "stale"
                  ? "warn"
                  : "offline"
            }
          >
            {connectivityLabel(snapshot.health.connectivityStatus, language)}
          </StatusPill>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-1 rounded-full glass-panel p-1">
            {(
              [
                ["orbit", t("twin3d.view.orbit")],
                ["front", t("twin3d.view.front")],
                ["technical", t("twin3d.view.technical")],
              ] as [ViewPreset, string][]
            ).map(([preset, label]) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyView(preset)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  view === preset
                    ? "bg-noctua-500/90 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAutoRotate((value) => !value)}
            className={cn(hudButton, autoRotate && hudButtonActive)}
            title={t("twin3d.autoRotate")}
          >
            <RotateCw className={cn("h-3.5 w-3.5", autoRotate && !paused && "animate-spin [animation-duration:3s]")} />
            <span className="hidden md:inline">{t("twin3d.autoRotate")}</span>
          </button>
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            className={cn(hudButton, paused && hudButtonActive)}
            title={paused ? t("twin3d.resume") : t("twin3d.pause")}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">{paused ? t("twin3d.resume") : t("twin3d.pause")}</span>
          </button>
          <button
            type="button"
            onClick={() => setPanelOpen((value) => !value)}
            className={cn(hudButton, panelOpen && hudButtonActive, "lg:hidden")}
            title={t("twin3d.metrics")}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Hover/selection chip */}
      {activePart && (
        <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 sm:top-20">
          <div className="flex items-center gap-2 rounded-full glass-panel px-4 py-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATE_COLORS[model.partStates[activePart]] }} />
            <span className="text-xs font-semibold text-slate-800 dark:text-white">{t(PART_LABEL_KEYS[activePart])}</span>
          </div>
        </div>
      )}

      {/* Metrics side panel (left) */}
      <aside
        className={cn(
          "absolute bottom-0 left-0 top-14 z-10 w-full max-w-[15.5rem] -translate-x-full overflow-y-auto p-2.5 transition-transform duration-300 sm:top-16 lg:translate-x-0",
          panelOpen && "translate-x-0",
        )}
      >
        <div className="space-y-2.5 rounded-2xl glass-panel p-3 shadow-panel">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aurora-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-aurora-500" />
              </span>
              {t("twin3d.metrics")}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-400 dark:text-slate-500">{timeAgo(snapshot.lastUpdatedAt, language)}</span>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white lg:hidden"
                onClick={() => setPanelOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {selected && (
            <div className="rounded-xl border border-aurora-400/30 bg-white/70 p-2.5 dark:bg-noctua-800/70">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{t(PART_LABEL_KEYS[selected])}</p>
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                  style={{ backgroundColor: `${STATE_COLORS[model.partStates[selected]]}22`, color: STATE_COLORS[model.partStates[selected]] }}
                >
                  {t(`twin3d.state.${model.partStates[selected]}`)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="mt-1 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {t("twin3d.clearSelection")}
              </button>
            </div>
          )}
          {!selected && <p className="text-[10px] leading-snug text-slate-500">{t("twin3d.selectHint")}</p>}

          <div className={cn(surfaceCard, "divide-y divide-slate-200/70 px-3 dark:divide-white/5")}>
            {metrics.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                  {label}
                </span>
                <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-slate-900 dark:text-white">{value}</span>
              </div>
            ))}
          </div>

          {ai?.faultPrediction?.label && (
            <div className={cn(surfaceCard, "p-2.5")}>
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t("twin3d.ai")}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-700 dark:text-slate-200">
                {ai.faultPrediction.label}
                {ai.faultPrediction.confidencePct != null && (
                  <span className="text-slate-500 dark:text-slate-400"> · {Math.round(ai.faultPrediction.confidencePct)}%</span>
                )}
              </p>
              {ai.powerForecast?.predictedPowerW != null && (
                <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                  {t("twin3d.aiForecast", { power: formatNumber(ai.powerForecast.predictedPowerW, 0) })}
                </p>
              )}
            </div>
          )}

          <div className={cn(surfaceCard, "p-2.5")}>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {t("nav.alarms")} ({openAlarms.length})
            </p>
            {openAlarms.length === 0 ? (
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{t("twin3d.noAlarms")}</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {openAlarms.map((alarm) => (
                  <li key={alarm.id} className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-700 dark:text-slate-200">
                    <span
                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          alarm.severity === "critical" ? STATE_COLORS.critical : alarm.severity === "warning" ? STATE_COLORS.warning : "#53b6ff",
                      }}
                    />
                    <span className="truncate">{alarm.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 right-3 hidden items-center gap-3 rounded-full glass-panel px-4 py-2 sm:flex">
        {(["normal", "warning", "critical", "offline"] as const).map((state) => (
          <span key={state} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-300">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATE_COLORS[state] }} />
            {t(`twin3d.state.${state}`)}
          </span>
        ))}
        <span className="flex items-center gap-1.5 border-l border-slate-300 pl-3 text-[10px] uppercase tracking-wide text-slate-600 dark:border-white/15 dark:text-slate-300">
          <Box className="h-3 w-3" />
          {t("twin3d.dragHint")}
        </span>
      </div>
    </div>
  );
};
