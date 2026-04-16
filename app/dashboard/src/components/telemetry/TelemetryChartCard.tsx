import { ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel } from "@/components/ui/Panel";
import { TelemetryPoint } from "@/types/dashboard";
import { formatCompactTime, formatNumber } from "@/utils/format";
import { useDashboardData } from "@/hooks/useDashboardData";

type ChartVariant = "line" | "area";

const axisStyle = {
  stroke: "rgba(148, 163, 184, 0.8)",
  fontSize: 11,
};

export const TelemetryChartCard = ({
  title,
  subtitle,
  data,
  dataKey,
  unit,
  color,
  secondaryColor,
  variant = "line",
  footer,
}: {
  title: string;
  subtitle: string;
  data: TelemetryPoint[];
  dataKey: keyof TelemetryPoint;
  unit: string;
  color: string;
  secondaryColor?: string;
  variant?: ChartVariant;
  footer?: ReactNode;
}) => {
  const { language } = useDashboardData();
  const chartData = data.map((point) => ({
    ...point,
    value: point[dataKey] ?? null,
    label: formatCompactTime(point.timestamp, language),
  }));

  return (
    <Panel className="h-full">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-slate-300/70 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          {formatNumber(chartData.length ? (chartData[chartData.length - 1]?.value as number | null | undefined) : null, 1)} {unit}
          </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {variant === "area" ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`${String(dataKey)}Gradient`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={secondaryColor || color} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={28} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<ChartTooltip unit={unit} />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#${String(dataKey)}Gradient)`}
                connectNulls
              />
            </AreaChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={28} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<ChartTooltip unit={unit} />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: color }}
                connectNulls
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {footer ? <div className="mt-4">{footer}</div> : null}
    </Panel>
  );
};

const ChartTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm shadow-xl dark:border-white/10 dark:bg-noctua-900/95">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-900 dark:text-white">
        {formatNumber(payload[0].value, 2)} {unit}
      </div>
    </div>
  );
};
