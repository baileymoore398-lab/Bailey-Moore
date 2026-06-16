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
  background: "#131a24",
  border: "1px solid #222c3a",
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
        <CartesianGrid stroke="#222c3a" strokeDasharray="3 3" />
        <XAxis
          dataKey={bucketKey}
          tick={{ fill: "#8a99ad", fontSize: 10 }}
          interval={0}
          angle={-12}
          textAnchor="end"
          height={44}
        />
        <YAxis tick={{ fill: "#8a99ad", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(34,211,238,0.08)" }} />
        <Bar
          dataKey="distance_km"
          fill="#22d3ee"
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
        <CartesianGrid stroke="#222c3a" strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fill: "#8a99ad", fontSize: 10 }} height={36} />
        <YAxis
          yAxisId="speed"
          tick={{ fill: "#8a99ad", fontSize: 11 }}
        />
        <YAxis
          yAxisId="hr"
          orientation="right"
          tick={{ fill: "#8a99ad", fontSize: 11 }}
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
