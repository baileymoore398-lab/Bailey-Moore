"use client";

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
import type { AthleteProfile } from "@/lib/types";

const tooltipStyle = {
  background: "#131a24",
  border: "1px solid #222c3a",
  borderRadius: 8,
  fontSize: 12,
  color: "#fff",
};

export function ScoreTrend({ trend }: { trend: AthleteProfile["trend"] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={trend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#222c3a" strokeDasharray="3 3" />
        <XAxis dataKey="race" tick={{ fill: "#8a99ad", fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={48} />
        <YAxis domain={[40, 100]} tick={{ fill: "#8a99ad", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="overall" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3 }} name="Overall" />
        <Line type="monotone" dataKey="navigation" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} name="Navigation" />
        <Line type="monotone" dataKey="fitness" stroke="#a3e635" strokeWidth={2} dot={{ r: 2 }} name="Fitness" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TimeLossTrend({ trend }: { trend: AthleteProfile["trend"] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={trend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="loss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#222c3a" strokeDasharray="3 3" />
        <XAxis dataKey="race" tick={{ fill: "#8a99ad", fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={48} />
        <YAxis tick={{ fill: "#8a99ad", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="time_loss_s" stroke="#f97316" strokeWidth={2} fill="url(#loss)" name="Time lost (s)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
