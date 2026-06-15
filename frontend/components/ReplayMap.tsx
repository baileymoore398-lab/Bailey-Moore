"use client";

import * as React from "react";
import maplibregl from "maplibre-gl";
import type { Control, Leg, TrackPoint } from "@/lib/types";

interface ReplayMapProps {
  track: TrackPoint[];
  controls: Control[];
  /** 0..track.length-1 — current replay index */
  cursor: number;
  /** highlighted leg number (1-based) or null */
  highlightLeg?: number | null;
  legs?: Leg[];
}

/** A minimal raster style using OSM tiles, dark-tinted via CSS overlay. */
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

/** Map a speed (km/h) to a colour from slow (blue) to fast (lime). */
function speedColor(speed: number, max: number): string {
  const t = Math.max(0, Math.min(1, max > 0 ? speed / max : 0));
  // blue -> cyan -> lime
  const stops: [number, [number, number, number]][] = [
    [0, [56, 102, 224]],
    [0.5, [34, 211, 238]],
    [1, [163, 230, 53]],
  ];
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0] || 1;
  const f = (t - lo[0]) / span;
  const c = lo[1].map((v, i) => Math.round(v + (hi[1][i] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function ReplayMap({
  track,
  controls,
  cursor,
  highlightLeg,
  legs,
}: ReplayMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const markerRef = React.useRef<maplibregl.Marker | null>(null);
  const [ready, setReady] = React.useState(false);

  const maxSpeed = React.useMemo(
    () => track.reduce((m, p) => Math.max(m, p.speed_kmh), 0) || 1,
    [track]
  );

  const bounds = React.useMemo(() => {
    const b = new maplibregl.LngLatBounds();
    track.forEach((p) => b.extend([p.lon, p.lat]));
    controls.forEach((c) => {
      if (c.lat != null && c.lon != null) b.extend([c.lon, c.lat]);
    });
    return b;
  }, [track, controls]);

  // Init map once.
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current || track.length === 0) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      bounds: bounds.isEmpty() ? undefined : bounds,
      fitBoundsOptions: { padding: 60 },
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      // Speed-coloured track: build a line feature per segment.
      const segments = {
        type: "FeatureCollection",
        features: track.slice(0, -1).map((p, i) => ({
          type: "Feature" as const,
          properties: {
            color: speedColor((p.speed_kmh + track[i + 1].speed_kmh) / 2, maxSpeed),
            leg: legForIndex(i, track, controls),
          },
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [p.lon, p.lat],
              [track[i + 1].lon, track[i + 1].lat],
            ],
          },
        })),
      };
      map.addSource("track", { type: "geojson", data: segments as never });
      map.addLayer({
        id: "track-line",
        type: "line",
        source: "track",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 4,
          "line-opacity": 0.9,
        },
      });
      // Highlight layer (drawn on top, controlled via filter).
      map.addLayer({
        id: "track-highlight",
        type: "line",
        source: "track",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 7,
          "line-opacity": 0.9,
        },
        filter: ["==", ["get", "leg"], -1],
      });

      // Controls as circle markers + labels.
      const controlPts = controls.filter((c) => c.lat != null && c.lon != null);
      map.addSource("controls", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: controlPts.map((c) => ({
            type: "Feature" as const,
            properties: { code: c.code, conf: c.confidence },
            geometry: {
              type: "Point" as const,
              coordinates: [c.lon as number, c.lat as number],
            },
          })),
        } as never,
      });
      map.addLayer({
        id: "control-circles",
        type: "circle",
        source: "controls",
        paint: {
          "circle-radius": 9,
          "circle-color": "rgba(10,14,20,0.2)",
          "circle-stroke-color": "#f97316",
          "circle-stroke-width": 2.5,
        },
      });
      map.addLayer({
        id: "control-labels",
        type: "symbol",
        source: "controls",
        layout: {
          "text-field": ["get", "code"],
          "text-size": 12,
          "text-offset": [0, -1.4],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#0a0e14",
          "text-halo-width": 1.5,
        },
      });

      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start / finish HTML markers.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || track.length === 0) return;
    const start = track[0];
    const finish = track[track.length - 1];

    const startEl = document.createElement("div");
    startEl.className =
      "h-0 w-0 border-x-[7px] border-b-[12px] border-x-transparent border-b-emerald-400 drop-shadow";
    const startMarker = new maplibregl.Marker({ element: startEl })
      .setLngLat([start.lon, start.lat])
      .addTo(map);

    const finishEl = document.createElement("div");
    finishEl.className =
      "grid h-4 w-4 place-items-center rounded-sm bg-white text-[9px] font-black text-bg shadow";
    finishEl.textContent = "▣";
    const finishMarker = new maplibregl.Marker({ element: finishEl })
      .setLngLat([finish.lon, finish.lat])
      .addTo(map);

    return () => {
      startMarker.remove();
      finishMarker.remove();
    };
  }, [ready, track]);

  // Moving replay dot.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || track.length === 0) return;
    const idx = Math.max(0, Math.min(track.length - 1, cursor));
    const pt = track[idx];

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className =
        "h-4 w-4 rounded-full bg-accent ring-4 ring-accent/30 shadow-[0_0_16px_rgba(34,211,238,0.9)]";
      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([pt.lon, pt.lat])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([pt.lon, pt.lat]);
    }
  }, [cursor, ready, track]);

  // Leg highlight via filter.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("track-highlight")) return;
    map.setFilter("track-highlight", [
      "==",
      ["get", "leg"],
      highlightLeg ?? -1,
    ]);
  }, [highlightLeg, ready]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden rounded-xl"
      style={{ minHeight: 380 }}
    />
  );
}

/**
 * Estimate which leg (1-based) a track index belongs to by finding the nearest
 * control passed. Controls are ordered; we split the track at the closest
 * track point to each control.
 */
function legForIndex(
  index: number,
  track: TrackPoint[],
  controls: Control[]
): number {
  const ctrlIdx = controlTrackIndices(track, controls);
  for (let leg = 0; leg < ctrlIdx.length; leg++) {
    if (index < ctrlIdx[leg]) return leg + 1;
  }
  return ctrlIdx.length + 1;
}

let _cache: { track: TrackPoint[]; controls: Control[]; idx: number[] } | null =
  null;
function controlTrackIndices(
  track: TrackPoint[],
  controls: Control[]
): number[] {
  if (_cache && _cache.track === track && _cache.controls === controls)
    return _cache.idx;
  const pts = controls
    .filter((c) => c.lat != null && c.lon != null)
    .sort((a, b) => a.order - b.order);
  const idx = pts.map((c) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < track.length; i++) {
      const d =
        (track[i].lat - (c.lat as number)) ** 2 +
        (track[i].lon - (c.lon as number)) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  });
  idx.sort((a, b) => a - b);
  _cache = { track, controls, idx };
  return idx;
}
