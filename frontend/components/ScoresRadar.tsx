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
        <PolarGrid stroke="#2c3322" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fill: "#9aa089", fontSize: 11 }}
        />
        <Radar
          dataKey="value"
          stroke="#2ecf6e"
          fill="#2ecf6e"
          fillOpacity={0.35}
          dot={{ r: 3, fill: "#2ecf6e" }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
