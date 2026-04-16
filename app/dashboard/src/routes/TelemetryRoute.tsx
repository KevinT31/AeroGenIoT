import { Activity, BatteryCharging, Thermometer, Waves, Wind, Zap } from "lucide-react";
import { RangeSelector } from "@/components/telemetry/RangeSelector";
import { TelemetryChartCard } from "@/components/telemetry/TelemetryChartCard";
import { KpiCard } from "@/components/ui/KpiCard";
import { useDashboardData } from "@/hooks/useDashboardData";
import { formatNumber } from "@/utils/format";
import { translateDashboard } from "@/i18n/translations";

export const TelemetryRoute = () => {
  const { snapshot, timeRange, setTimeRange, language } = useDashboardData();
  const hasVibrationSignal = snapshot.latest?.vibrationSignal !== null || snapshot.history.some((point) => point.vibrationSignal !== null);

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <RangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <KpiCard
          icon={Zap}
          label={translateDashboard(language, "telemetry.batteryPower")}
          value={`${formatNumber(snapshot.latest?.powerW, 0)} W`}
          helper={translateDashboard(language, "telemetry.batteryPowerHelper")}
        />
        <KpiCard
          icon={Activity}
          label={translateDashboard(language, "telemetry.housePower")}
          value={`${formatNumber(snapshot.latest?.loadPowerW, 0)} W`}
          helper={translateDashboard(language, "telemetry.housePowerHelper")}
        />
        <KpiCard
          icon={Thermometer}
          label={translateDashboard(language, "telemetry.temp")}
          value={`${formatNumber(snapshot.latest?.genTempC, 1)} C`}
          helper={translateDashboard(language, "telemetry.tempHelper")}
        />
        <KpiCard
          icon={BatteryCharging}
          label={translateDashboard(language, "telemetry.battery")}
          value={`${formatNumber(snapshot.latest?.batteryPct, 0)} %`}
          helper={translateDashboard(language, "telemetry.batteryHelper")}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TelemetryChartCard title={translateDashboard(language, "telemetry.chart.wind.title")} subtitle={translateDashboard(language, "telemetry.chart.wind.subtitle")} data={snapshot.history} dataKey="windSpeedMs" unit="m/s" color="#5af3d7" />
        <TelemetryChartCard title={translateDashboard(language, "telemetry.chart.power.title")} subtitle={translateDashboard(language, "telemetry.chart.power.subtitle")} data={snapshot.history} dataKey="powerW" unit="W" color="#3db8ff" variant="area" />
        <TelemetryChartCard title={translateDashboard(language, "telemetry.chart.energy.title")} subtitle={translateDashboard(language, "telemetry.chart.energy.subtitle")} data={snapshot.history} dataKey="energyTodayKwh" unit="kWh" color="#7dcbff" variant="area" />
        <TelemetryChartCard title={translateDashboard(language, "telemetry.chart.temp.title")} subtitle={translateDashboard(language, "telemetry.chart.temp.subtitle")} data={snapshot.history} dataKey="genTempC" unit="C" color="#ff8f7a" />
        <TelemetryChartCard title={translateDashboard(language, "telemetry.chart.vibration.title")} subtitle={translateDashboard(language, "telemetry.chart.vibration.subtitle")} data={snapshot.history} dataKey="vibrationRms" unit="m/s2" color="#ff7aa2" />
        <TelemetryChartCard title={translateDashboard(language, "telemetry.chart.load.title")} subtitle={translateDashboard(language, "telemetry.chart.load.subtitle")} data={snapshot.history} dataKey="loadPowerW" unit="W" color="#53b6ff" />
        <TelemetryChartCard title={translateDashboard(language, "telemetry.chart.voltage.title")} subtitle={translateDashboard(language, "telemetry.chart.voltage.subtitle")} data={snapshot.history} dataKey="genVoltageV" unit="V" color="#9fbcff" />
        <TelemetryChartCard title={translateDashboard(language, "telemetry.chart.current.title")} subtitle={translateDashboard(language, "telemetry.chart.current.subtitle")} data={snapshot.history} dataKey="genCurrentA" unit="A" color="#ffd27d" />
        <TelemetryChartCard title={translateDashboard(language, "telemetry.chart.acVoltage.title")} subtitle={translateDashboard(language, "telemetry.chart.acVoltage.subtitle")} data={snapshot.history} dataKey="outputVoltageAcV" unit="V" color="#84c0ff" />
        <TelemetryChartCard title={translateDashboard(language, "telemetry.chart.acCurrent.title")} subtitle={translateDashboard(language, "telemetry.chart.acCurrent.subtitle")} data={snapshot.history} dataKey="outputCurrentAcA" unit="A" color="#ffd98f" />
        <TelemetryChartCard title={translateDashboard(language, "telemetry.chart.rpm.title")} subtitle={translateDashboard(language, "telemetry.chart.rpm.subtitle")} data={snapshot.history} dataKey="rotorRpm" unit="rpm" color="#ff9c6d" />
        {hasVibrationSignal ? (
          <TelemetryChartCard title={translateDashboard(language, "telemetry.chart.vibrationSignal.title")} subtitle={translateDashboard(language, "telemetry.chart.vibrationSignal.subtitle")} data={snapshot.history} dataKey="vibrationSignal" unit="raw" color="#d38bff" />
        ) : null}
      </div>
    </div>
  );
};
