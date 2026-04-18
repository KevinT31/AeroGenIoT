import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ENV } from "@/config/env";
import { useDashboardData } from "@/hooks/useDashboardData";
import { connectivityLabel, formatDateTime, formatNumber } from "@/utils/format";
import { translateDashboard } from "@/i18n/translations";

export const DeviceRoute = () => {
  const { snapshot, language } = useDashboardData();
  const openAlarms = snapshot.alarms.filter((alarm) => alarm.status === "open");
  const hasVibrationSignal =
    snapshot.latest?.vibrationSignal !== null && snapshot.latest?.vibrationSignal !== undefined;
  const windDirection =
    snapshot.latest?.windDirectionDeg === null || snapshot.latest?.windDirectionDeg === undefined
      ? "--"
      : `${formatNumber(snapshot.latest?.windDirectionDeg, 0)}°`;

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={translateDashboard(language, "device.eyebrow")}
        title={translateDashboard(language, "device.title")}
        description={translateDashboard(language, "device.description")}
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel>
          <h3 className="font-display text-xl font-semibold text-slate-950 dark:text-white">
            {translateDashboard(language, "device.profile")}
          </h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InfoCard label={translateDashboard(language, "device.displayName")} value={ENV.deviceLabel} />
            <InfoCard
              label={translateDashboard(language, "device.connectivity")}
              value={connectivityLabel(snapshot.health.connectivityStatus, language)}
            />
            <InfoCard
              label={translateDashboard(language, "device.lastReading")}
              value={formatDateTime(snapshot.health.timestamp, language)}
            />
            <InfoCard label={translateDashboard(language, "device.windDirection")} value={windDirection} />
            <InfoCard label={translateDashboard(language, "device.battery")} value={`${formatNumber(snapshot.latest?.batteryPct, 0)} %`} />
            <InfoCard label={translateDashboard(language, "device.autonomy")} value={`${formatNumber(snapshot.latest?.estimatedAutonomyHours, 1)} h`} />
            <InfoCard label={translateDashboard(language, "device.activeAlarms")} value={String(openAlarms.length)} />
            <InfoCard label={translateDashboard(language, "device.realDeviceId")} value={snapshot.health.deviceId} long />
          </div>
        </Panel>

        <Panel>
          <h3 className="font-display text-xl font-semibold text-slate-950 dark:text-white">
            {translateDashboard(language, "device.instantMetrics")}
          </h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <MetricTile label={translateDashboard(language, "device.wind")} value={`${formatNumber(snapshot.latest?.windSpeedMs, 1)} m/s`} />
            <MetricTile label={translateDashboard(language, "device.dcVoltage")} value={`${formatNumber(snapshot.latest?.genVoltageV, 1)} V`} />
            <MetricTile label={translateDashboard(language, "device.dcCurrent")} value={`${formatNumber(snapshot.latest?.genCurrentA, 1)} A`} />
            <MetricTile label={translateDashboard(language, "device.batteryPower")} value={`${formatNumber(snapshot.latest?.powerW, 0)} W`} />
            <MetricTile label={translateDashboard(language, "device.temperature")} value={`${formatNumber(snapshot.latest?.genTempC, 1)} C`} />
            <MetricTile label={translateDashboard(language, "device.vibration")} value={`${formatNumber(snapshot.latest?.vibrationRms, 2)} m/s2`} />
            <MetricTile label={translateDashboard(language, "device.battery")} value={`${formatNumber(snapshot.latest?.batteryPct, 0)} %`} />
            <MetricTile label={translateDashboard(language, "device.acVoltage")} value={`${formatNumber(snapshot.latest?.outputVoltageAcV, 1)} V`} />
            <MetricTile label={translateDashboard(language, "device.acCurrent")} value={`${formatNumber(snapshot.latest?.outputCurrentAcA, 1)} A`} />
            <MetricTile label={translateDashboard(language, "device.load")} value={`${formatNumber(snapshot.latest?.loadPowerW, 0)} W`} />
            <MetricTile label={translateDashboard(language, "device.energyDelivered")} value={`${formatNumber(snapshot.latest?.energyTodayKwh, 2)} kWh`} />
            <MetricTile label={translateDashboard(language, "device.autonomy")} value={`${formatNumber(snapshot.latest?.estimatedAutonomyHours, 1)} h`} />
            <MetricTile label={translateDashboard(language, "device.rpm")} value={`${formatNumber(snapshot.latest?.rotorRpm, 0)} rpm`} />
            {hasVibrationSignal ? (
              <MetricTile
                label={translateDashboard(language, "device.vibrationSignal")}
                value={formatNumber(snapshot.latest?.vibrationSignal, 3)}
              />
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
};

const InfoCard = ({ label, value, long = false }: { label: string; value: string; long?: boolean }) => (
  <div className={long ? "md:col-span-2" : undefined}>
    <div className="rounded-[24px] border border-slate-300/80 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/5">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">{label}</div>
      <div className="mt-2 text-sm leading-6 text-slate-800 dark:text-slate-200">{value}</div>
    </div>
  </div>
);

const MetricTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[24px] border border-slate-300/80 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/5">
    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">{label}</div>
    <div className="mt-3 font-display text-2xl font-semibold text-slate-950 dark:text-white">{value}</div>
  </div>
);
