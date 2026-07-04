"use client";

import { motion } from "framer-motion";

/**
 * Semi-circular race-readiness gauge. Value is 0-100.
 */
export function ReadinessGauge({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const radius = 80;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference * (1 - v / 100);

  const color =
    v >= 75 ? "#a3e635" : v >= 50 ? "#2ecf6e" : v >= 30 ? "#f97316" : "#ef4444";
  const label =
    v >= 75 ? "Race ready" : v >= 50 ? "Building" : v >= 30 ? "Caution" : "Rest";

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width={200} height={120} viewBox="0 0 200 120">
          <path
            d="M 20 110 A 80 80 0 0 1 180 110"
            fill="none"
            stroke="#2c3322"
            strokeWidth={14}
            strokeLinecap="round"
          />
          <motion.path
            d="M 20 110 A 80 80 0 0 1 180 110"
            fill="none"
            stroke={color}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <span
            className="text-3xl font-black tabular-nums"
            style={{ color }}
          >
            {Math.round(v)}
          </span>
          <span className="text-xs uppercase tracking-wider text-muted">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
