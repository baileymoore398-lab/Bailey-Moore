"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrainingAnalytics, VolumeBucket } from "@/lib/types";

const tooltipStyle = {
  background: "#171b12",
  border: "1px solid #2c3322",
  borderRadius: 8,
  fontSize: 12,
  color: "#fff",
};

export function VolumeBars({
  data,
  bucketKey,
}: {
  data: VolumeBucket[];
  bucketKey: "week" | "month";
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#2c3322" strokeDasharray="3 3" />
        <XAxis
          dataKey={bucketKey}
          tick={{ fill: "#9aa089", fontSize: 10 }}
          interval={0}
          angle={-12}
          textAnchor="end"
          height={44}
        />
        <YAxis tick={{ fill: "#9aa089", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(34,211,238,0.08)" }} />
        <Bar
          dataKey="distance_km"
          fill="#2ecf6e"
          radius={[4, 4, 0, 0]}
          name="Distance (km)"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SpeedHrChart({
  data,
}: {
  data: TrainingAnalytics["speed_hr_trends"];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#2c3322" strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fill: "#9aa089", fontSize: 10 }} height={36} />
        <YAxis
          yAxisId="speed"
          tick={{ fill: "#9aa089", fontSize: 11 }}
        />
        <YAxis
          yAxisId="hr"
          orientation="right"
          tick={{ fill: "#9aa089", fontSize: 11 }}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          yAxisId="speed"
          type="monotone"
          dataKey="avg_speed_kmh"
          stroke="#a3e635"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          name="Avg speed (km/h)"
        />
        <Line
          yAxisId="hr"
          type="monotone"
          dataKey="avg_hr"
          stroke="#f97316"
          strokeWidth={2}
          dot={{ r: 2 }}
          name="Avg HR (bpm)"
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
