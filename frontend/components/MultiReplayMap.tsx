"use client";

import * as React from "react";
import maplibregl from "maplibre-gl";
import type { EventReplayCompetitor } from "@/lib/types";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";

interface MultiReplayMapProps {
  competitors: EventReplayCompetitor[];
}

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0a0e14" } },
    {
      id: "osm",
      type: "raster",
      source: "osm",
      paint: { "raster-opacity": 0.55, "raster-saturation": -0.5 },
    },
  ],
};

const SPEEDS = [1, 2, 4, 8];

/** Find the point index for a competitor at a given elapsed time (seconds). */
function indexForElapsed(
  pts: EventReplayCompetitor["points"],
  elapsed: number
): number {
  if (pts.length === 0) return 0;
  let i = 0;
  while (i < pts.length - 1 && pts[i + 1].elapsed_s <= elapsed) i++;
  return i;
}

export function MultiReplayMap({ competitors }: MultiReplayMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const markersRef = React.useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = React.useState(false);

  // Visibility per competitor (by name).
  const [hidden, setHidden] = React.useState<Record<string, boolean>>({});

  // Replay clock (elapsed seconds across all tracks).
  const [elapsed, setElapsed] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(4);
  const rafRef = React.useRef<number | null>(null);
  const lastTsRef = React.useRef<number | null>(null);
  const elapsedRef = React.useRef(0);
  elapsedRef.current = elapsed;

  const totalElapsed = React.useMemo(
    () =>
      competitors.reduce((max, c) => {
        const last = c.points[c.points.length - 1]?.elapsed_s ?? 0;
        return Math.max(max, last);
      }, 0),
    [competitors]
  );

  const bounds = React.useMemo(() => {
    const b = new maplibregl.LngLatBounds();
    competitors.forEach((c) =>
      c.points.forEach((p) => b.extend([p.lon, p.lat]))
    );
    return b;
  }, [competitors]);

  // Init map + draw every track.
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current || competitors.length === 0)
      return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      bounds: bounds.isEmpty() ? undefined : bounds,
      fitBoundsOptions: { padding: 60 },
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );
    mapRef.current = map;

    map.on("load", () => {
      const features = competitors
        .filter((c) => c.points.length > 1)
        .map((c) => ({
          type: "Feature" as const,
          properties: { name: c.name, color: c.color },
          geometry: {
            type: "LineString" as const,
            coordinates: c.points.map((p) => [p.lon, p.lat]),
          },
        }));
      map.addSource("tracks", {
        type: "geojson",
        data: { type: "FeatureCollection", features } as never,
      });
      map.addLayer({
        id: "track-lines",
        type: "line",
        source: "tracks",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3,
          "line-opacity": 0.85,
        },
      });
      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create one moving marker per competitor.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = competitors.map((c) => {
      const el = document.createElement("div");
      el.className = "h-3.5 w-3.5 rounded-full ring-2 ring-black/40 shadow";
      el.style.background = c.color;
      el.style.boxShadow = `0 0 12px ${c.color}`;
      const start = c.points[0];
      const marker = new maplibregl.Marker({ element: el });
      if (start) marker.setLngLat([start.lon, start.lat]);
      marker.addTo(map);
      return marker;
    });
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [ready, competitors]);

  // Move markers + toggle visibility on each clock tick.
  React.useEffect(() => {
    if (!ready) return;
    competitors.forEach((c, i) => {
      const marker = markersRef.current[i];
      if (!marker) return;
      const el = marker.getElement();
      if (hidden[c.name] || c.points.length === 0) {
        el.style.display = "none";
        return;
      }
      el.style.display = "block";
      const idx = indexForElapsed(c.points, elapsed);
      const p = c.points[idx];
      marker.setLngLat([p.lon, p.lat]);
    });
  }, [elapsed, ready, competitors, hidden]);

  // Toggle track line visibility through a filter on hidden names.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("track-lines")) return;
    const hiddenNames = Object.keys(hidden).filter((n) => hidden[n]);
    map.setFilter(
      "track-lines",
      ["!", ["in", ["get", "name"], ["literal", hiddenNames]]] as never
    );
  }, [hidden, ready]);

  // Animation loop.
  React.useEffect(() => {
    if (!playing) {
      lastTsRef.current = null;
      return;
    }
    const step = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dtMs = ts - lastTsRef.current;
      lastTsRef.current = ts;
      const next = elapsedRef.current + (dtMs / 1000) * speed;
      if (next >= totalElapsed) {
        setElapsed(totalElapsed);
        setPlaying(false);
        return;
      }
      setElapsed(next);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, totalElapsed]);

  const toggle = () => {
    if (elapsed >= totalElapsed) setElapsed(0);
    setPlaying((p) => !p);
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden rounded-xl"
        style={{ minHeight: 420 }}
      />

      {/* Controls (mirrors ReplayControls). */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-bg-soft/60 p-3">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="accent"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "❚❚" : "▶"}
          </Button>
          <div className="flex-1">
            <Slider
              aria-label="Replay position"
              min={0}
              max={Math.max(1, Math.round(totalElapsed))}
              value={Math.round(elapsed)}
              onValueChange={(v) => {
                setPlaying(false);
                setElapsed(v);
              }}
            />
          </div>
          <div className="w-24 text-right font-mono text-sm tabular-nums text-muted">
            {formatDuration(elapsed)} / {formatDuration(totalElapsed)}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
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
      </div>

      {/* Legend with show/hide toggles. */}
      <div className="flex flex-wrap gap-2">
        {competitors.map((c) => {
          const isHidden = !!hidden[c.name];
          return (
            <button
              key={c.name}
              onClick={() =>
                setHidden((h) => ({ ...h, [c.name]: !h[c.name] }))
              }
              className={
                "flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm transition " +
                (isHidden
                  ? "bg-bg-soft/40 text-muted opacity-60"
                  : "bg-bg-elevated/60 text-white hover:bg-bg-elevated")
              }
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: c.color }}
              />
              {c.position != null && (
                <span className="font-mono tabular-nums text-muted">
                  {c.position}.
                </span>
              )}
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
