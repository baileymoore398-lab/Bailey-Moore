"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { Analysis, TrackPoint } from "@/lib/types";
import { formatDistance, formatDuration } from "@/lib/utils";

type Ratio = "square" | "story" | "landscape";

const RATIOS: Record<Ratio, { w: number; h: number; label: string }> = {
  square: { w: 1080, h: 1080, label: "Square · 1:1" },
  story: { w: 1080, h: 1920, label: "Story · 9:16" },
  landscape: { w: 1080, h: 608, label: "Landscape · 16:9" },
};

const VIDEO_MS = 7000;

/* ----------------------------- drawing helpers ---------------------------- */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function speedColor(speed: number, max: number): string {
  const t = Math.max(0, Math.min(1, max > 0 ? speed / max : 0));
  const stops: [number, [number, number, number]][] = [
    [0, [59, 130, 246]],
    [0.5, [46, 207, 110]],
    [1, [217, 245, 107]],
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
  const f = (t - lo[0]) / (hi[0] - lo[0] || 1);
  const c = lo[1].map((v, i) => Math.round(v + (hi[1][i] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Draw the RouteForge logo mark (64×64 design) at x,y scaled to size s. */
function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const k = s / 64;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  const g = ctx.createLinearGradient(6, 6, 58, 58);
  g.addColorStop(0, "#34d977");
  g.addColorStop(1, "#1c9e57");
  roundRect(ctx, 0, 0, 64, 64, 16);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(15, 50);
  ctx.lineTo(26, 31);
  ctx.lineTo(38, 41);
  ctx.lineTo(49, 17);
  ctx.strokeStyle = "#0a1a10";
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(15, 50, 4.6, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(49, 17, 7.5, 0, Math.PI * 2);
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 3.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(49, 17, 2.7, 0, Math.PI * 2);
  ctx.fillStyle = "#f97316";
  ctx.fill();
  ctx.restore();
}

interface Projected {
  pts: { x: number; y: number; speed: number }[];
  controls: { x: number; y: number }[];
}

/** Project lat/lon track + controls into a rectangle, preserving aspect. */
function project(
  track: TrackPoint[],
  controls: Analysis["controls"],
  rx: number,
  ry: number,
  rw: number,
  rh: number
): Projected {
  const ctrl = controls.filter((c) => c.lat != null && c.lon != null);
  const lats = track.map((p) => p.lat);
  const lons = track.map((p) => p.lon);
  ctrl.forEach((c) => {
    lats.push(c.lat as number);
    lons.push(c.lon as number);
  });
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const meanLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const lonK = Math.cos(meanLat) || 1;
  const gw = (maxLon - minLon) * lonK || 1e-6;
  const gh = maxLat - minLat || 1e-6;
  const scale = Math.min(rw / gw, rh / gh);
  const ox = rx + (rw - gw * scale) / 2;
  const oy = ry + (rh - gh * scale) / 2;
  const toXY = (lat: number, lon: number) => ({
    x: ox + (lon - minLon) * lonK * scale,
    y: oy + (maxLat - lat) * scale,
  });
  return {
    pts: track.map((p) => ({ ...toXY(p.lat, p.lon), speed: p.speed_kmh })),
    controls: ctrl.map((c) => toXY(c.lat as number, c.lon as number)),
  };
}

interface SceneOpts {
  analysis: Analysis;
  title: string;
  ratio: Ratio;
  /** 0..1 — how much of the route to reveal (1 = whole route, static). */
  progress: number;
}

function drawScene(ctx: CanvasRenderingContext2D, o: SceneOpts) {
  const { w: W, h: H } = RATIOS[o.ratio];
  const a = o.analysis;
  const pad = Math.round(W * 0.07);
  const F = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  // Background
  ctx.fillStyle = "#0c0e0a";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.8, H * 0.12, 0, W * 0.8, H * 0.12, W * 0.9);
  glow.addColorStop(0, "rgba(46,207,110,0.18)");
  glow.addColorStop(1, "rgba(46,207,110,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Header: logo mark + wordmark
  let y = pad;
  const markSize = Math.round(W * 0.085);
  drawMark(ctx, pad, y, markSize);
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.round(markSize * 0.6)}px ${F}`;
  const wmX = pad + markSize + Math.round(W * 0.025);
  const wmY = y + markSize / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Route", wmX, wmY);
  const routeW = ctx.measureText("Route").width;
  ctx.fillStyle = "#2ecf6e";
  ctx.fillText("Forge", wmX + routeW, wmY);

  // Title
  y += markSize + Math.round(W * 0.058);
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 ${Math.round(W * 0.058)}px ${F}`;
  ctx.fillStyle = "#ffffff";
  const title = o.title.slice(0, 42);
  ctx.fillText(title, pad, y);
  y += Math.round(W * 0.02);

  // Layout: reserve space at the bottom for stats + footer.
  const statsH = Math.round(W * 0.16);
  const footerH = Math.round(W * 0.06);
  const mapTop = y + Math.round(W * 0.03);
  const mapBottom = H - pad - statsH - footerH;
  const mapH = Math.max(W * 0.4, mapBottom - mapTop);

  // Map panel
  roundRect(ctx, pad, mapTop, W - pad * 2, mapH, Math.round(W * 0.03));
  ctx.fillStyle = "#11140d";
  ctx.fill();
  ctx.strokeStyle = "rgba(44,51,34,0.9)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Route
  const inset = Math.round(W * 0.04);
  const track = a.track;
  if (track.length > 1) {
    const { pts, controls } = project(
      track,
      a.controls,
      pad + inset,
      mapTop + inset,
      W - pad * 2 - inset * 2,
      mapH - inset * 2
    );
    const maxSpeed = track.reduce((mx, p) => Math.max(mx, p.speed_kmh), 0) || 1;
    const reveal = Math.max(1, Math.floor(pts.length * o.progress));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, W * 0.009);
    for (let i = 1; i < reveal; i++) {
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = speedColor((pts[i - 1].speed + pts[i].speed) / 2, maxSpeed);
      ctx.stroke();
    }
    // Controls
    controls.forEach((c) => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, W * 0.013, 0, Math.PI * 2);
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = Math.max(2.5, W * 0.004);
      ctx.stroke();
    });
    // Start
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, W * 0.011, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    // Moving head dot (during reveal) / finish (when complete)
    const head = pts[Math.min(reveal - 1, pts.length - 1)];
    if (o.progress < 1) {
      ctx.beginPath();
      ctx.arc(head.x, head.y, W * 0.016, 0, Math.PI * 2);
      ctx.fillStyle = "#2ecf6e";
      ctx.shadowColor = "rgba(46,207,110,0.9)";
      ctx.shadowBlur = W * 0.03;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      const fin = pts[pts.length - 1];
      const fs = W * 0.022;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(fin.x - fs / 2, fin.y - fs / 2, fs, fs);
    }
  }

  // Stats row
  const stats: [string, string][] = [
    ["DISTANCE", formatDistance(a.metrics.distance_m)],
    ["TIME", formatDuration(a.metrics.duration_s)],
    ["CLIMB", `${Math.round(a.metrics.total_climb_m)} m`],
    ["SCORE", String(a.scores.overall)],
  ];
  const sy = mapTop + mapH + Math.round(W * 0.055);
  const cellW = (W - pad * 2) / stats.length;
  stats.forEach(([label, value], i) => {
    const cx = pad + cellW * i + cellW / 2;
    ctx.textAlign = "center";
    ctx.font = `800 ${Math.round(W * 0.052)}px ${F}`;
    ctx.fillStyle = i === 3 ? "#2ecf6e" : "#ffffff";
    ctx.fillText(value, cx, sy);
    ctx.font = `600 ${Math.round(W * 0.02)}px ${F}`;
    ctx.fillStyle = "#9aa089";
    ctx.fillText(label, cx, sy + Math.round(W * 0.035));
  });
  ctx.textAlign = "left";

  // Footer
  ctx.font = `600 ${Math.round(W * 0.022)}px ${F}`;
  ctx.fillStyle = "#6b7363";
  ctx.fillText("routeforge — AI race analysis", pad, H - pad * 0.7);
}

/* -------------------------------- component ------------------------------- */

function pickMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  // Prefer MP4 (Chrome 121+, Edge, Safari record it natively); fall back to
  // WebM, which we then transcode to MP4 with ffmpeg.wasm.
  const types = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

// Lazy-loaded WebM→MP4 transcode (only for browsers that can't record MP4).
// Core is fetched on demand from a CDN, so it never bloats the initial bundle.
async function transcodeToMp4(
  webm: Blob,
  onProgress: (pct: number) => void
): Promise<Blob> {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
  const ffmpeg = new FFmpeg();
  const base = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  });
  ffmpeg.on("progress", ({ progress }) =>
    onProgress(Math.max(0, Math.min(100, Math.round(progress * 100))))
  );
  await ffmpeg.writeFile("in.webm", await fetchFile(webm));
  await ffmpeg.exec([
    "-i",
    "in.webm",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "out.mp4",
  ]);
  const data = (await ffmpeg.readFile("out.mp4")) as Uint8Array;
  return new Blob([data as unknown as BlobPart], { type: "video/mp4" });
}

export function ShareStudio({
  analysis,
  defaultTitle = "Race recap",
}: {
  analysis: Analysis;
  defaultTitle?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [ratio, setRatio] = React.useState<Ratio>("square");
  const [title, setTitle] = React.useState(defaultTitle);
  const [recording, setRecording] = React.useState(false);
  const [recPct, setRecPct] = React.useState(0);
  const [converting, setConverting] = React.useState(false);
  const [convPct, setConvPct] = React.useState(0);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const busy = recording || converting;

  // Quick-fill caption presets, built from this race's data.
  const presets = React.useMemo(() => {
    const out = ["Race recap"];
    if (analysis.created_at) {
      const d = new Date(analysis.created_at);
      if (!isNaN(d.getTime()))
        out.push(
          d.toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        );
    }
    out.push(
      `${formatDistance(analysis.metrics.distance_m)} · ${formatDuration(
        analysis.metrics.duration_s
      )}`
    );
    out.push(`Overall ${analysis.scores.overall}/100`);
    return Array.from(new Set(out));
  }, [analysis]);

  const videoMime = React.useMemo(() => (open ? pickMime() : null), [open]);

  const redraw = React.useCallback(
    (progress = 1) => {
      const c = canvasRef.current;
      if (!c) return;
      const { w, h } = RATIOS[ratio];
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      drawScene(ctx, { analysis, title, ratio, progress });
    },
    [analysis, title, ratio]
  );

  React.useEffect(() => {
    if (open) redraw(1);
  }, [open, redraw]);

  function download(blob: Blob, ext: string) {
    const safe = title.replace(/[^\w-]+/g, "_").slice(0, 40) || "routeforge";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `routeforge-${safe}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadPhoto(type: "image/png" | "image/jpeg") {
    redraw(1);
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob(
      (blob) => blob && download(blob, type === "image/png" ? "png" : "jpg"),
      type,
      0.95
    );
  }

  function recordVideo() {
    const c = canvasRef.current;
    if (!c || !videoMime || busy) return;
    setRecording(true);
    setRecPct(0);
    const stream = c.captureStream(30);
    const chunks: BlobPart[] = [];
    const mr = new MediaRecorder(stream, {
      mimeType: videoMime,
      videoBitsPerSecond: 8_000_000,
    });
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = async () => {
      const blob = new Blob(chunks, { type: videoMime });
      setRecording(false);
      setRecPct(0);
      redraw(1);
      if (videoMime.includes("mp4")) {
        // Recorded natively as MP4 — no conversion needed.
        download(blob, "mp4");
        return;
      }
      // WebM → transcode to MP4; fall back to WebM if that fails.
      setConverting(true);
      setConvPct(0);
      try {
        const mp4 = await transcodeToMp4(blob, setConvPct);
        download(mp4, "mp4");
      } catch {
        download(blob, "webm");
      } finally {
        setConverting(false);
        setConvPct(0);
      }
    };
    mr.start();
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / VIDEO_MS);
      redraw(p);
      setRecPct(Math.round(p * 100));
      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        // Hold the final frame briefly, then stop.
        setTimeout(() => mr.state !== "inactive" && mr.stop(), 350);
      }
    };
    requestAnimationFrame(tick);
  }

  return (
    <>
      <Button variant="accent" onClick={() => setOpen(true)}>
        📲 Share
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-bg-card p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-tight">
                  Share to social
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Generate a branded image or an animated replay video.
                </p>
              </div>
              <button
                onClick={() => !busy && setOpen(false)}
                className="rounded-lg px-2 py-1 text-muted transition hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
              {/* Preview */}
              <div className="grid place-items-center rounded-xl border border-border bg-bg-soft/40 p-3">
                <canvas
                  ref={canvasRef}
                  className="max-h-[60vh] w-auto max-w-full rounded-lg"
                  style={{ aspectRatio: `${RATIOS[ratio].w}/${RATIOS[ratio].h}` }}
                />
              </div>

              {/* Controls */}
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
                    Caption
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={42}
                    placeholder="Race recap"
                    className="w-full rounded-lg border border-border bg-bg-soft px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {presets.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setTitle(p)}
                        className={
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition " +
                          (title === p
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border text-muted hover:text-white")
                        }
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
                    Format
                  </label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {(Object.keys(RATIOS) as Ratio[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRatio(r)}
                        disabled={busy}
                        className={
                          "rounded-lg border px-3 py-2 text-left text-sm font-medium transition " +
                          (ratio === r
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border text-muted hover:text-white")
                        }
                      >
                        {RATIOS[r].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 border-t border-border/60 pt-4">
                  <Button
                    variant="accent"
                    className="w-full"
                    disabled={busy}
                    onClick={() => downloadPhoto("image/png")}
                  >
                    ⬇ Download photo (PNG)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    onClick={() => downloadPhoto("image/jpeg")}
                  >
                    Download photo (JPG)
                  </Button>
                  {videoMime ? (
                    <Button
                      variant="default"
                      className="w-full"
                      disabled={busy}
                      onClick={recordVideo}
                    >
                      {recording
                        ? `Recording… ${recPct}%`
                        : converting
                          ? `Converting to MP4… ${convPct}%`
                          : "🎬 Record replay video (MP4)"}
                    </Button>
                  ) : (
                    <p className="text-center text-xs text-muted">
                      Video export isn&apos;t supported in this browser — photos
                      work everywhere.
                    </p>
                  )}
                  {videoMime && (
                    <p className="text-center text-[11px] leading-relaxed text-muted">
                      Saves as MP4. On browsers that record WebM, it&apos;s
                      converted to MP4 automatically (first conversion downloads
                      a small encoder).
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
