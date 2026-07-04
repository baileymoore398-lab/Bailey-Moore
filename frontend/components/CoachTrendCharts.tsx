"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CoachTrendPoint } from "@/lib/types";

const tooltipStyle = {
  background: "#171b12",
  border: "1px solid #2c3322",
  borderRadius: 8,
  fontSize: 12,
  color: "#fff",
};

const xAxis = (
  <XAxis
    dataKey="race"
    tick={{ fill: "#9aa089", fontSize: 10 }}
    interval={0}
    angle={-12}
    textAnchor="end"
    height={48}
  />
);

function Chart({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-card/60 p-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
        {title}
      </h4>
      <ResponsiveContainer width="100%" height={200}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export function CoachTrendCharts({ series }: { series: CoachTrendPoint[] }) {
  if (!series.length) {
    return (
      <p className="rounded-lg border border-border bg-bg-soft/60 p-4 text-sm text-muted">
        No trend data available yet.
      </p>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Chart title="Navigation">
        <LineChart data={series} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#2c3322" strokeDasharray="3 3" />
          {xAxis}
          <YAxis tick={{ fill: "#9aa089", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone"
            dataKey="navigation"
            stroke="#2ecf6e"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            name="Navigation"
            connectNulls
          />
        </LineChart>
      </Chart>

      <Chart title="Route efficiency %">
        <LineChart data={series} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#2c3322" strokeDasharray="3 3" />
          {xAxis}
          <YAxis tick={{ fill: "#9aa089", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone"
            dataKey="route_efficiency_pct"
            stroke="#a3e635"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            name="Efficiency %"
            connectNulls
          />
        </LineChart>
      </Chart>

      <Chart title="Time loss (s)">
        <LineChart data={series} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#2c3322" strokeDasharray="3 3" />
          {xAxis}
          <YAxis tick={{ fill: "#9aa089", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone"
            dataKey="time_loss_s"
            stroke="#f97316"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            name="Time loss (s)"
            connectNulls
          />
        </LineChart>
      </Chart>
    </div>
  );
}
