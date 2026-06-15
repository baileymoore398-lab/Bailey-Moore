import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format seconds as m:ss or h:mm:ss. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Format a short signed time-loss, e.g. +32s or 0s. */
export function formatTimeLoss(seconds: number): string {
  if (!seconds) return "0s";
  return `+${Math.round(seconds)}s`;
}

/** Format meters as km or m. */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

/** Format pace (min/km) as m:ss /km. */
export function formatPace(minPerKm: number): string {
  if (!minPerKm || !isFinite(minPerKm)) return "–";
  const m = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - m) * 60);
  return `${m}:${String(sec).padStart(2, "0")} /km`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
