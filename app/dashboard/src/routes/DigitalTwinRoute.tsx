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

  const liveResponses = [
    translateDashboard(language, "twin.response.wind"),
    translateDashboard(language, "twin.response.vibration"),
    translateDashboard(language, "twin.response.temperature"),
    translateDashboard(language, "twin.response.electrical"),
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
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            {translateDashboard(language, "twin.routeHardwareDescription")}
          </p>
          <div className="mt-5 space-y-3">
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
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            {translateDashboard(language, "twin.routeResponsesDescription")}
          </p>
          <div className="mt-5 space-y-3">
            {liveResponses.map((response) => (
              <div
                key={response}
                className="rounded-2xl border border-slate-300/80 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                {response}
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <h3 className="font-display text-xl font-semibold text-slate-950 dark:text-white">
            {translateDashboard(language, "twin.routeFocusTitle")}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            {translateDashboard(language, "twin.routeFocusDescription")}
          </p>
          <div className="mt-5 space-y-3">
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
