"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { Scores } from "@/lib/types";

export function ScoresRadar({ scores }: { scores: Scores }) {
  const data = [
    { axis: "Navigation", value: scores.navigation },
    { axis: "Fitness", value: scores.fitness },
    { axis: "Execution", value: scores.execution },
    { axis: "Route choice", value: scores.route_choice },
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#222c3a" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fill: "#8a99ad", fontSize: 11 }}
        />
        <Radar
          dataKey="value"
          stroke="#22d3ee"
          fill="#22d3ee"
          fillOpacity={0.35}
          dot={{ r: 3, fill: "#22d3ee" }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
