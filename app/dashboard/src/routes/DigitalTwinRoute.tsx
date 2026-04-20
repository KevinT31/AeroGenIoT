import { DigitalTwin2D } from "@/components/twin/DigitalTwin2D";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { useDashboardData } from "@/hooks/useDashboardData";
import { translateDashboard } from "@/i18n/translations";
import { formatNumber } from "@/utils/format";

const toneForState = (state: "normal" | "warning" | "critical" | "offline") => {
  if (state === "critical") return "critical" as const;
  if (state === "warning") return "warn" as const;
  if (state === "offline") return "offline" as const;
  return "ok" as const;
};

const formatDirectionLabel = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${Math.round(value)}\u00B0`;
};

const statusText = (
  language: ReturnType<typeof useDashboardData>["language"],
  status: "normal" | "warning" | "critical" | "offline",
) => {
  if (status === "normal") return translateDashboard(language, "connectivity.live");
  if (status === "warning") return translateDashboard(language, "overview.reserveStatus.watch");
  if (status === "critical") return translateDashboard(language, "health.status.critical");
  return translateDashboard(language, "health.status.offline");
};

const sourceLabel = (
  language: ReturnType<typeof useDashboardData>["language"],
  sourceNow: "WIND" | "BATTERY" | "BOTH" | null | undefined,
) => {
  if (sourceNow === "WIND") return translateDashboard(language, "source.wind");
  if (sourceNow === "BATTERY") return translateDashboard(language, "source.battery");
  if (sourceNow === "BOTH") return translateDashboard(language, "source.hybrid");
  return translateDashboard(language, "source.unknown");
};

const sourceNarrative = (
  language: ReturnType<typeof useDashboardData>["language"],
  sourceNow: "WIND" | "BATTERY" | "BOTH" | null | undefined,
) => {
  if (sourceNow === "WIND") return translateDashboard(language, "source.narrative.wind");
  if (sourceNow === "BATTERY") return translateDashboard(language, "source.narrative.battery");
  if (sourceNow === "BOTH") return translateDashboard(language, "source.narrative.hybrid");
  return translateDashboard(language, "source.waiting");
};

const batteryFlowNarrative = (
  language: ReturnType<typeof useDashboardData>["language"],
  powerW: number | null | undefined,
) => {
  if (powerW === null || powerW === undefined) return translateDashboard(language, "source.waiting");
  if (powerW > 60) return translateDashboard(language, "health.generationSupports");
  if (powerW < -60) return translateDashboard(language, "source.narrative.wind");
  return translateDashboard(language, "health.reserveNormal");
};

const outputNarrative = (
  language: ReturnType<typeof useDashboardData>["language"],
  outputVoltageAcV: number | null | undefined,
) => {
  if (outputVoltageAcV === null || outputVoltageAcV === undefined) return translateDashboard(language, "health.noLiveData");
  if (outputVoltageAcV < 50) return translateDashboard(language, "health.outputCut");
  if (outputVoltageAcV < 210 || outputVoltageAcV > 240) return translateDashboard(language, "health.outputWatch");
  return translateDashboard(language, "health.outputStable");
};

const reserveNarrative = (
  language: ReturnType<typeof useDashboardData>["language"],
  batteryPct: number | null | undefined,
) => {
  if (batteryPct === null || batteryPct === undefined) return translateDashboard(language, "health.unknownBattery");
  if (batteryPct < 20) return translateDashboard(language, "health.reserveLow");
  if (batteryPct < 40) return translateDashboard(language, "health.reserveWatch");
  return translateDashboard(language, "health.reserveNormal");
};

const reserveValueLabel = (
  batteryPct: number | null | undefined,
  autonomyHours: number | null | undefined,
) => {
  const pct = batteryPct === null || batteryPct === undefined ? null : `${formatNumber(batteryPct, 0)} %`;
  const autonomy = autonomyHours === null || autonomyHours === undefined ? null : `${formatNumber(autonomyHours, 1)} h`;

  if (pct && autonomy) return `${pct} · ${autonomy}`;
  if (pct) return pct;
  if (autonomy) return autonomy;
  return "--";
};

export const DigitalTwinRoute = () => {
  const { snapshot, language } = useDashboardData();

  const sensorMap = [
    {
      title: translateDashboard(language, "twin.sensor.as5600"),
      description: translateDashboard(language, "twin.sensor.as5600Hint"),
      value: formatDirectionLabel(snapshot.twin.windDirectionDeg),
      status: snapshot.twin.windDirectionStatus,
    },
    {
      title: translateDashboard(language, "twin.sensor.vibration"),
      description: translateDashboard(language, "twin.sensor.vibrationHint"),
      value: `${formatNumber(snapshot.latest?.vibrationRms, 2)} RMS`,
      status: snapshot.twin.vibrationStatus,
    },
    {
      title: translateDashboard(language, "twin.sensor.temperature"),
      description: translateDashboard(language, "twin.sensor.temperatureHint"),
      value: `${formatNumber(snapshot.latest?.genTempC, 1)} C`,
      status: snapshot.twin.temperatureStatus,
    },
    {
      title: translateDashboard(language, "twin.sensor.voltage"),
      description: translateDashboard(language, "twin.sensor.voltageHint"),
      value: `${formatNumber(snapshot.latest?.genVoltageV, 1)} V`,
      status: snapshot.twin.voltageStatus,
    },
  ];

  const operationalSummary = [
    {
      label: translateDashboard(language, "overview.sourceNow"),
      value: sourceLabel(language, snapshot.latest?.sourceNow),
      helper: sourceNarrative(language, snapshot.latest?.sourceNow),
    },
    {
      label: translateDashboard(language, "telemetry.batteryPower"),
      value: `${formatNumber(snapshot.latest?.powerW, 0)} W`,
      helper: batteryFlowNarrative(language, snapshot.latest?.powerW),
    },
    {
      label: translateDashboard(language, "telemetry.housePower"),
      value: `${formatNumber(snapshot.latest?.loadPowerW, 0)} W`,
      helper: outputNarrative(language, snapshot.latest?.outputVoltageAcV),
    },
    {
      label: translateDashboard(language, "overview.batterySection"),
      value: reserveValueLabel(snapshot.latest?.batteryPct, snapshot.latest?.estimatedAutonomyHours),
      helper: reserveNarrative(language, snapshot.latest?.batteryPct),
    },
  ];

  const focusItems = snapshot.twin.warnings.length
    ? snapshot.twin.warnings
    : [translateDashboard(language, "twin.noWarnings")];

  return (
    <div className="space-y-8">
      <DigitalTwin2D twin={snapshot.twin} latest={snapshot.latest} alarms={snapshot.alarms} />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr_1fr]">
        <Panel>
          <h3 className="font-display text-xl font-semibold text-slate-950 dark:text-white">
            {translateDashboard(language, "twin.routeHardwareTitle")}
          </h3>
          <div className="mt-4 space-y-3">
            {sensorMap.map((sensor) => (
              <div
                key={sensor.title}
                className="rounded-2xl border border-slate-300/80 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-base font-semibold text-slate-950 dark:text-white">
                      {sensor.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {sensor.description}
                    </div>
                  </div>
                  <StatusPill tone={toneForState(sensor.status)}>
                    {statusText(language, sensor.status)}
                  </StatusPill>
                </div>
                <div className="mt-3 font-mono text-sm text-slate-700 dark:text-slate-300">
                  {sensor.value}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <h3 className="font-display text-xl font-semibold text-slate-950 dark:text-white">
            {translateDashboard(language, "twin.routeResponsesTitle")}
          </h3>
          <div className="mt-4 space-y-3">
            {operationalSummary.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-300/80 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/5"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-500">
                  {item.label}
                </div>
                <div className="mt-2 font-display text-lg font-semibold text-slate-950 dark:text-white">
                  {item.value}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                  {item.helper}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <h3 className="font-display text-xl font-semibold text-slate-950 dark:text-white">
            {translateDashboard(language, "twin.routeFocusTitle")}
          </h3>
          <div className="mt-4 space-y-3">
            {focusItems.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-300/80 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                {item}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
};
