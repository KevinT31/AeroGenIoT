import { AlertTriangle, BatteryCharging, Gauge, TrendingUp, Zap } from "lucide-react";
import { HealthRing } from "@/components/overview/HealthRing";
import { TelemetryChartCard } from "@/components/telemetry/TelemetryChartCard";
import { KpiCard } from "@/components/ui/KpiCard";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { useDashboardData } from "@/hooks/useDashboardData";
import {
  summarizeWindow,
  formatNumber,
  connectivityLabel,
} from "@/utils/format";
import { translateDashboard } from "@/i18n/translations";

export const OverviewRoute = () => {
  const { snapshot, language } = useDashboardData();
  const summary = summarizeWindow(snapshot.history);
  const openAlarms = snapshot.alarms.filter((alarm) => alarm.status === "open");
  const batteryReserve = snapshot.latest?.batteryPct ?? null;
  const reserveLabel =
    batteryReserve === null || batteryReserve === undefined
      ? translateDashboard(language, "common.noData")
      : batteryReserve <= 10
        ? translateDashboard(language, "overview.reserveStatus.critical")
        : batteryReserve < 20
          ? translateDashboard(language, "overview.reserveStatus.low")
          : batteryReserve < 40
            ? translateDashboard(language, "overview.reserveStatus.watch")
            : translateDashboard(language, "overview.reserveStatus.normal");
  const reserveTone =
    batteryReserve === null || batteryReserve === undefined
      ? "offline"
      : batteryReserve <= 10
        ? "critical"
        : batteryReserve < 40
          ? "warn"
          : "ok";

  return (
    <div className="space-y-8">
      <div className="grid gap-4 xl:grid-cols-5">
        <KpiCard
          icon={Gauge}
          label={translateDashboard(language, "overview.dcVoltage")}
          value={`${formatNumber(snapshot.latest?.genVoltageV, 1)} V`}
          helper={translateDashboard(language, "telemetry.chart.voltage.subtitle")}
          accent="from-noctua-500/18 to-aurora-500/8"
          compact
        />
        <KpiCard
          icon={Zap}
          label={translateDashboard(language, "overview.housePower")}
          value={`${formatNumber(snapshot.latest?.loadPowerW, 0)} W`}
          helper={translateDashboard(language, "overview.housePowerHelper")}
          delta={translateDashboard(language, "overview.avgPower", {
            value: formatNumber(summary.avgHousePower, 0),
          })}
          accent="from-aurora-500/16 to-signal-info/10"
          compact
        />
        <KpiCard
          icon={TrendingUp}
          label={translateDashboard(language, "overview.energyToday")}
          value={`${formatNumber(snapshot.latest?.energyTodayKwh, 2)} kWh`}
          helper={translateDashboard(language, "overview.energyTodayHelper")}
          delta={translateDashboard(language, "overview.avgWind", {
            value: formatNumber(summary.avgWind, 1),
          })}
          accent="from-noctua-400/16 to-noctua-500/8"
          compact
        />
        <KpiCard
          icon={BatteryCharging}
          label={translateDashboard(language, "device.autonomy")}
          value={`${formatNumber(snapshot.latest?.estimatedAutonomyHours, 1)} h`}
          helper={snapshot.health.batteryStatus}
          accent="from-emerald-400/16 to-aurora-500/8"
          compact
        />
        <KpiCard
          icon={AlertTriangle}
          label={translateDashboard(language, "overview.activeAlarms")}
          value={openAlarms.length}
          helper={
            openAlarms.length
              ? translateDashboard(language, "overview.activeAlarmsLive")
              : translateDashboard(language, "overview.activeAlarmsNone")
          }
          delta={
            openAlarms.filter((alarm) => alarm.severity === "critical").length
              ? translateDashboard(language, "overview.criticalPresent")
              : translateDashboard(language, "overview.stable")
          }
          trend={openAlarms.filter((alarm) => alarm.severity === "critical").length ? "down" : "up"}
          accent="from-signal-danger/18 to-rose-400/8"
          compact
        />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[0.92fr_1.08fr]">
        <Panel className="flex h-full min-h-[34rem] flex-col">
          <div className="w-full">
            <SectionHeader
              eyebrow={translateDashboard(language, "overview.healthEyebrow")}
              title={translateDashboard(language, "overview.healthTitle")}
              description={translateDashboard(language, "overview.healthDescription")}
            />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
            <HealthRing score={batteryReserve ?? 0} label={reserveLabel} />
            <div className="flex flex-wrap justify-center gap-3">
              <StatusPill tone={reserveTone}>
                {reserveLabel}
              </StatusPill>
              <StatusPill tone={snapshot.health.connectivityStatus === "live" ? "ok" : snapshot.health.connectivityStatus === "stale" ? "warn" : "offline"}>
                {connectivityLabel(snapshot.health.connectivityStatus, language)}
              </StatusPill>
            </div>
            <p className="max-w-lg text-center text-sm leading-7 text-slate-600 dark:text-slate-400">
              {translateDashboard(language, "overview.batteryNarrative", {
                hours: formatNumber(snapshot.latest?.estimatedAutonomyHours, 1),
                power: formatNumber(snapshot.latest?.powerW, 0),
              })}
            </p>
          </div>
        </Panel>

        <Panel>
          <SectionHeader
            eyebrow={translateDashboard(language, "overview.operationEyebrow")}
            title={translateDashboard(language, "overview.operationTitle")}
            description={translateDashboard(language, "overview.operationDescription")}
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-slate-300/80 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-500">
                {translateDashboard(language, "overview.batterySection")}
              </p>
              <div className="mt-3 font-display text-3xl font-semibold text-slate-950 dark:text-white">
                {formatNumber(snapshot.latest?.batteryPct, 0)} %
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {translateDashboard(language, "overview.batteryNarrative", {
                  hours: formatNumber(snapshot.latest?.estimatedAutonomyHours, 1),
                  power: formatNumber(snapshot.latest?.powerW, 0),
                })}
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-300/80 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-500">
                {translateDashboard(language, "overview.recentExtremes")}
              </p>
              <dl className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <div className="flex items-center justify-between gap-4">
                  <dt>{translateDashboard(language, "overview.peakTemperature")}</dt>
                  <dd className="font-mono text-slate-950 dark:text-white">{formatNumber(summary.peakTemp, 1)} C</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>{translateDashboard(language, "overview.peakVibration")}</dt>
                  <dd className="font-mono text-slate-950 dark:text-white">{formatNumber(summary.peakVibration, 2)} m/s2</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>{translateDashboard(language, "overview.peakRpm")}</dt>
                  <dd className="font-mono text-slate-950 dark:text-white">{formatNumber(summary.peakRpm, 0)} rpm</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[28px] border border-slate-300/80 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-500">
                {translateDashboard(language, "layout.device")}
              </p>
              <dl className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-400">
                <div className="flex items-center justify-between gap-4">
                  <dt>{translateDashboard(language, "overview.outputVoltage")}</dt>
                  <dd className="font-mono text-slate-950 dark:text-white">{formatNumber(snapshot.latest?.outputVoltageAcV, 1)} V</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>{translateDashboard(language, "overview.outputCurrent")}</dt>
                  <dd className="font-mono text-slate-950 dark:text-white">{formatNumber(snapshot.latest?.outputCurrentAcA, 1)} A</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>{translateDashboard(language, "telemetry.wind")}</dt>
                  <dd className="font-mono text-slate-950 dark:text-white">{formatNumber(snapshot.latest?.windSpeedMs, 1)} m/s</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>{translateDashboard(language, "overview.dcVoltage")}</dt>
                  <dd className="font-mono text-slate-950 dark:text-white">{formatNumber(snapshot.latest?.genVoltageV, 1)} V</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[28px] border border-slate-300/80 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-500">
                {translateDashboard(language, "overview.activeAlarms")}
              </p>
              <div className="mt-4 space-y-3">
                {openAlarms.slice(0, 2).map((alarm) => (
                  <div
                    key={alarm.id}
                    className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-black/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-base font-semibold text-slate-950 dark:text-white">{alarm.title}</p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{alarm.suggestedAction || alarm.description}</p>
                      </div>
                      <StatusPill tone={alarm.severity === "critical" ? "critical" : "warn"}>
                        {alarm.severity}
                      </StatusPill>
                    </div>
                  </div>
                ))}

                {!openAlarms.length ? (
                  <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-black/10 dark:text-slate-400">
                    {translateDashboard(language, "overview.noOpenAlarms")}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <TelemetryChartCard
          title={translateDashboard(language, "overview.chart.load.title")}
          subtitle={translateDashboard(language, "overview.chart.load.subtitle")}
          data={snapshot.history}
          dataKey="loadPowerW"
          unit="W"
          color="#3db8ff"
          secondaryColor="#33d7c7"
          variant="area"
        />
        <TelemetryChartCard
          title={translateDashboard(language, "overview.chart.battery.title")}
          subtitle={translateDashboard(language, "overview.chart.battery.subtitle")}
          data={snapshot.history}
          dataKey="batteryPct"
          unit="%"
          color="#6fd39a"
          variant="line"
        />
        <TelemetryChartCard
          title={translateDashboard(language, "overview.chart.vibration.title")}
          subtitle={translateDashboard(language, "overview.chart.vibration.subtitle")}
          data={snapshot.history}
          dataKey="vibrationRms"
          unit="m/s2"
          color="#ff8f7a"
          variant="line"
        />
      </div>
    </div>
  );
};
