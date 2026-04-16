import { motion } from "framer-motion";
import {
  BatteryCharging,
  Cpu,
  Gauge,
  TowerControl,
  Wind,
} from "lucide-react";
import type { ReactNode } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { useDashboardData } from "@/hooks/useDashboardData";
import { translateDashboard } from "@/i18n/translations";
import { TwinAlertVisuals, TwinExactIllustration } from "@/components/twin/TwinExactIllustration";
import { AlarmItem, DigitalTwinState, TelemetryPoint } from "@/types/dashboard";
import { cn } from "@/utils/cn";
import { formatNumber } from "@/utils/format";

const toneClasses = {
  normal: "text-signal-ok border-signal-ok/20 bg-signal-ok/10",
  warning: "text-signal-warn border-signal-warn/20 bg-signal-warn/10",
  critical: "text-signal-danger border-signal-danger/20 bg-signal-danger/10",
  offline: "text-slate-400 border-slate-400/20 bg-slate-500/10",
};

const strokeColors = {
  normal: "#2bd47a",
  warning: "#f4b655",
  critical: "#ff6678",
  offline: "#7a8496",
};

const statusTone = {
  normal: "ok" as const,
  warning: "warn" as const,
  critical: "critical" as const,
  offline: "offline" as const,
};

const statusLabels = {
  en: {
    normal: "Nominal",
    warning: "Watch",
    critical: "Critical",
    offline: "Offline",
  },
  es: {
    normal: "Nominal",
    warning: "Atencion",
    critical: "Critico",
    offline: "Sin senal",
  },
};

const formatDirectionLabel = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${Math.round(value)}\u00B0`;
};

const buildAlertVisuals = (alarms: AlarmItem[]): TwinAlertVisuals => {
  const openTypes = new Set(alarms.filter((alarm) => alarm.status === "open").map((alarm) => alarm.type));

  return {
    batteryLow: openTypes.has("battery_low") || openTypes.has("soc_low"),
    batteryCritical: openTypes.has("battery_critical") || openTypes.has("soc_critical"),
    batteryVoltageLow: openTypes.has("battery_voltage_low"),
    batteryVoltageHigh: openTypes.has("battery_voltage_high"),
    batteryDischargeHigh: openTypes.has("battery_discharge_current_high"),
    batteryChargeHigh: openTypes.has("battery_charge_current_high"),
    batteryOvertemperature: openTypes.has("battery_overtemperature"),
    controllerOverload: openTypes.has("controller_overload"),
    acVoltageLow: openTypes.has("ac_voltage_low"),
    acVoltageHigh: openTypes.has("ac_voltage_high"),
    acCurrentHigh: openTypes.has("ac_current_high"),
    housePowerHigh: openTypes.has("house_power_high"),
    inverterOverload: openTypes.has("inverter_overload"),
    inverterFault: openTypes.has("inverter_fault"),
    supplyCut: openTypes.has("supply_cut"),
    inverterTempHigh: openTypes.has("inverter_temp_high"),
    lowWind: openTypes.has("low_wind"),
    highWind: openTypes.has("high_wind"),
    vibrationHigh: openTypes.has("vibration_high"),
    vibrationCritical: openTypes.has("vibration_critical"),
    rotorRpmOutOfRange: openTypes.has("rotor_rpm_out_of_range"),
  };
};

export const DigitalTwin2D = ({
  twin,
  latest,
  alarms,
  compact = false,
}: {
  twin: DigitalTwinState;
  latest: TelemetryPoint | null;
  alarms: AlarmItem[];
  compact?: boolean;
}) => {
  const { language, themeMode } = useDashboardData();
  const isDarkMode = themeMode === "dark";
  const alertVisuals = buildAlertVisuals(alarms);
  let rotorDuration = Math.max(2.3, 8 - twin.animationLevel * 5.2);
  if (alertVisuals.lowWind) rotorDuration = Math.max(rotorDuration, 6.6);
  if (alertVisuals.highWind) rotorDuration = Math.min(rotorDuration, 1.7);
  if (alertVisuals.rotorRpmOutOfRange) rotorDuration = Math.min(rotorDuration, 1.05);
  const rotorSpeed = `${rotorDuration.toFixed(2)}s`;
  let anemometerDuration = Math.max(1.5, 3.4 - twin.animationLevel * 1.9);
  if (alertVisuals.lowWind) anemometerDuration = Math.max(anemometerDuration, 4.5);
  if (alertVisuals.highWind) anemometerDuration = Math.min(anemometerDuration, 1.15);
  const anemometerSpeed = `${anemometerDuration.toFixed(2)}s`;
  const activeWind =
    twin.connectivityStatus !== "offline" &&
    ((latest?.windSpeedMs ?? 0) > 1.2 || alertVisuals.lowWind || alertVisuals.highWind);
  const powerCableColor =
    alertVisuals.supplyCut
      ? "#ff6678"
      : twin.electricalStatus === "critical"
      ? "#ff6678"
      : twin.electricalStatus === "warning"
        ? "#f4b655"
        : "#355fe2";
  const generatorCoreColor =
    alertVisuals.inverterFault
      ? "#ff6678"
      : twin.generatorStatus === "critical"
      ? "#ff8459"
      : twin.generatorStatus === "warning"
        ? "#d8a24d"
        : "#c97b34";
  const connectivityStatusLabel =
    twin.connectivityStatus === "warning"
      ? translateDashboard(language, "connectivity.stale")
      : twin.connectivityStatus === "offline"
        ? translateDashboard(language, "connectivity.offline")
        : translateDashboard(language, "connectivity.live");
  const windDirectionValue = twin.windDirectionDeg ?? latest?.windDirectionDeg;
  const showVibrationPulse =
    twin.vibrationStatus === "warning" ||
    twin.vibrationStatus === "critical" ||
    alertVisuals.vibrationHigh ||
    alertVisuals.vibrationCritical;
  const showThermalGlow =
    twin.temperatureStatus === "warning" ||
    twin.temperatureStatus === "critical" ||
    alertVisuals.inverterTempHigh ||
    alertVisuals.batteryOvertemperature;
  const showElectricalFlow =
    twin.electricalStatus !== "normal" ||
    twin.powerFlowLevel > 0.28 ||
    alertVisuals.acCurrentHigh ||
    alertVisuals.batteryDischargeHigh ||
    alertVisuals.batteryChargeHigh;
  const vaneRotation = windDirectionValue ?? 0;
  const cablePulseDuration = Math.max(1.15, 2.5 - Math.min(twin.powerFlowLevel, 1) * 1.2);
  const housePowered =
    !alertVisuals.supplyCut &&
    twin.connectivityStatus !== "offline" &&
    ((latest?.powerW ?? 0) > 30 || twin.powerFlowLevel > 0.24);
  const houseLightColor = housePowered
    ? alertVisuals.housePowerHigh
      ? "rgba(255, 204, 88, 1)"
      : "rgba(255, 228, 126, 0.96)"
    : alertVisuals.supplyCut
      ? "rgba(255, 118, 118, 0.16)"
      : "rgba(212, 218, 228, 0.3)";
  const batteryCableColor =
    alertVisuals.batteryChargeHigh
      ? "#14b8a6"
      : twin.batteryStatus === "critical"
      ? "#ff6678"
      : twin.batteryStatus === "warning"
        ? "#f4b655"
        : "#4d71ff";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[34px] border border-slate-300/80 bg-white/90 p-4 shadow-twin dark:border-white/10 dark:bg-noctua-900/70",
        compact ? "min-h-0" : "min-h-0",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(61,184,255,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(51,215,199,0.12),transparent_28%),linear-gradient(180deg,rgba(9,18,32,0.02),transparent_55%)]" />

      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-noctua-500 dark:text-noctua-300">
                {translateDashboard(language, "twin.title")}
              </p>
              <StatusPill tone={statusTone[twin.generatorStatus]} className="shrink-0 whitespace-nowrap">
                {statusLabels[language][twin.generatorStatus]}
              </StatusPill>
              <StatusPill tone={statusTone[twin.connectivityStatus]} className="shrink-0 whitespace-nowrap">
                {connectivityStatusLabel}
              </StatusPill>
            </div>
            <h3 className="mt-2 font-display text-2xl font-semibold text-slate-950 dark:text-white">
              {translateDashboard(language, "twin.subtitle")}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              {translateDashboard(language, "twin.description")}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <TopStat
            label={translateDashboard(language, "telemetry.wind")}
            value={`${formatNumber(latest?.windSpeedMs, 1)} m/s`}
          />
          <TopStat
            label={translateDashboard(language, "twin.metric.direction")}
            value={formatDirectionLabel(windDirectionValue)}
          />
          <TopStat
            label={translateDashboard(language, "twin.metric.temperature")}
            value={`${formatNumber(latest?.genTempC, 1)} C`}
          />
          <TopStat
            label={translateDashboard(language, "twin.metric.voltage")}
            value={`${formatNumber(latest?.genVoltageV, 1)} V`}
          />
        </div>
      </div>

      <div
        className={cn(
          "relative mt-5 grid gap-4 xl:items-start",
          compact ? "xl:grid-cols-[1.68fr_0.92fr]" : "xl:grid-cols-[1.82fr_0.86fr]",
        )}
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-[32px] border border-sky-100/90 bg-[linear-gradient(180deg,#ebf8ff_0%,#f8fcff_42%,#edf6ff_100%)] dark:border-sky-400/15 dark:bg-[linear-gradient(180deg,rgba(17,31,48,0.96)_0%,rgba(12,24,38,0.98)_44%,rgba(8,17,29,1)_100%)]",
            compact ? "p-3 pt-2" : "p-4 pt-2",
          )}
        >
          <div className="absolute inset-0 bg-grid-fine bg-[size:32px_32px] opacity-[0.05] dark:opacity-[0.1]" />
          <div className="absolute inset-x-8 top-2 h-20 rounded-full bg-sky-200/35 blur-3xl dark:bg-noctua-400/15" />
          <div className="absolute inset-x-12 bottom-4 h-28 rounded-full bg-transparent blur-3xl dark:bg-noctua-600/10" />

          <div className={cn("relative", compact ? "-mt-6" : "-mt-12")}>
            <TwinExactIllustration
              twin={twin}
              alertVisuals={alertVisuals}
              darkMode={isDarkMode}
              compact={compact}
              activeWind={activeWind}
              rotorSpeed={rotorSpeed}
              anemometerSpeed={anemometerSpeed}
              showVibrationPulse={showVibrationPulse}
              showThermalGlow={showThermalGlow}
              showElectricalFlow={showElectricalFlow}
              cablePulseDuration={cablePulseDuration}
              vaneRotation={vaneRotation}
              housePowered={housePowered}
              houseLightColor={houseLightColor}
              powerCableColor={powerCableColor}
              batteryCableColor={batteryCableColor}
              generatorCoreColor={generatorCoreColor}
            />
          </div>
        </div>

        <div className="space-y-3 xl:max-h-[780px] xl:overflow-y-auto xl:pr-1">
          <div className="rounded-[28px] border border-slate-300/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/5">
            <h4 className="font-display text-lg font-semibold text-slate-950 dark:text-white">
              {translateDashboard(language, "twin.componentsTitle")}
            </h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <ComponentStateCard
                icon={<Wind className="h-4 w-4" />}
                title={translateDashboard(language, "twin.rotor")}
                caption={translateDashboard(language, "twin.liveTrack")}
                status={twin.rotorStatus}
                value={`${formatNumber(latest?.windSpeedMs, 1)} m/s`}
                language={language}
              />
              <ComponentStateCard
                icon={<Cpu className="h-4 w-4" />}
                title={translateDashboard(language, "twin.generator")}
                caption={translateDashboard(language, "telemetry.temp")}
                status={twin.generatorStatus}
                value={`${formatNumber(latest?.genTempC, 1)} C`}
                language={language}
              />
              <ComponentStateCard
                icon={<TowerControl className="h-4 w-4" />}
                title={translateDashboard(language, "twin.tower")}
                caption={translateDashboard(language, "twin.structuralCore")}
                status={twin.towerStatus}
                value={translateDashboard(language, "twin.structuralCore")}
                language={language}
              />
              <ComponentStateCard
                icon={<Gauge className="h-4 w-4" />}
                title={translateDashboard(language, "twin.electrical")}
                caption={translateDashboard(language, "telemetry.power")}
                status={twin.electricalStatus}
                value={`${formatNumber(latest?.powerW, 0)} W`}
                language={language}
              />
              <ComponentStateCard
                icon={<BatteryCharging className="h-4 w-4" />}
                title={translateDashboard(language, "twin.battery")}
                caption={translateDashboard(language, "telemetry.battery")}
                status={twin.batteryStatus}
                value={`${formatNumber(latest?.batteryPct, 0)} %`}
                language={language}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const TopStat = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="rounded-3xl border border-slate-300/80 bg-white/85 px-4 py-3 dark:border-white/10 dark:bg-white/5">
    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
      {label}
    </div>
    <div className="mt-2 font-display text-2xl font-semibold text-slate-950 dark:text-white">
      {value}
    </div>
  </div>
);

const ComponentStateCard = ({
  icon,
  title,
  caption,
  status,
  value,
  language,
}: {
  icon: ReactNode;
  title: string;
  caption: string;
  status: keyof typeof toneClasses;
  value: string;
  language: "en" | "es";
}) => (
  <div className="rounded-[24px] border border-slate-300/80 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-black/20">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-2xl border",
            toneClasses[status],
          )}
        >
          {icon}
        </div>
        <div>
          <div className="font-display text-base font-semibold text-slate-950 dark:text-white">
            {title}
          </div>
          <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-500">
            {caption}
          </div>
        </div>
      </div>
      <StatusPill tone={statusTone[status]}>
        {statusLabels[language][status]}
      </StatusPill>
    </div>
    <div className="mt-4 font-mono text-sm text-slate-700 dark:text-slate-300">
      {value}
    </div>
  </div>
);


