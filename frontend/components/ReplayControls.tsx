"use client";

import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import type { TrackPoint } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

interface ReplayControlsProps {
  track: TrackPoint[];
  cursor: number;
  setCursor: (i: number) => void;
}

const SPEEDS = [1, 2, 4, 8];

export function ReplayControls({ track, cursor, setCursor }: ReplayControlsProps) {
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(4);
  const rafRef = React.useRef<number | null>(null);
  const lastTsRef = React.useRef<number | null>(null);
  const cursorRef = React.useRef(cursor);
  cursorRef.current = cursor;

  const t0 = track[0]?.t ?? 0;
  const tEnd = track[track.length - 1]?.t ?? 0;
  const elapsed = (track[cursor]?.t ?? t0) - t0;
  const total = tEnd - t0;

  React.useEffect(() => {
    if (!playing) {
      lastTsRef.current = null;
      return;
    }
    const step = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dtMs = ts - lastTsRef.current;
      lastTsRef.current = ts;
      // Advance replay time: dt seconds * speed multiplier.
      const advanceSec = (dtMs / 1000) * speed;
      let i = cursorRef.current;
      const targetT = (track[i]?.t ?? t0) + advanceSec;
      while (i < track.length - 1 && track[i + 1].t <= targetT) i++;
      if (i >= track.length - 1) {
        setCursor(track.length - 1);
        setPlaying(false);
        return;
      }
      setCursor(i);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, track]);

  const toggle = () => {
    if (cursor >= track.length - 1) setCursor(0);
    setPlaying((p) => !p);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-bg-soft/60 p-3">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="accent" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚" : "▶"}
        </Button>
        <div className="flex-1">
          <Slider
            aria-label="Replay position"
            min={0}
            max={Math.max(0, track.length - 1)}
            value={cursor}
            onValueChange={(v) => {
              setPlaying(false);
              setCursor(v);
            }}
          />
        </div>
        <div className="w-24 text-right font-mono text-sm tabular-nums text-muted">
          {formatDuration(elapsed)} / {formatDuration(total)}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted">Speed</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={
                "rounded px-2 py-0.5 font-medium transition " +
                (speed === s
                  ? "bg-accent text-bg"
                  : "bg-bg-elevated text-muted hover:text-white")
              }
            >
              {s}×
            </button>
          ))}
        </div>
        <span className="font-mono tabular-nums text-muted">
          {(track[cursor]?.speed_kmh ?? 0).toFixed(1)} km/h
        </span>
      </div>
    </div>
  );
}
