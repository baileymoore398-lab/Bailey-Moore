"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
  className?: string;
  "aria-label"?: string;
}

/**
 * Minimal accessible slider built on a styled native range input so we avoid
 * a Radix dependency while keeping keyboard + screen-reader support.
 */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  className,
  ...props
}: SliderProps) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onValueChange(Number(e.target.value))}
      className={cn("rf-slider w-full cursor-pointer", className)}
      style={{
        background: `linear-gradient(to right, #2ecf6e ${pct}%, #2c3322 ${pct}%)`,
      }}
      {...props}
    />
  );
}
