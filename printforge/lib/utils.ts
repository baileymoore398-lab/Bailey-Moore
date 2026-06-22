import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NZD = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD"
});

export function money(n: number | null | undefined): string {
  return NZD.format(n ?? 0);
}

export function genOrderNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PF-${ymd}-${rand}`;
}

export const ORDER_STATUS_STEPS = [
  "SUBMITTED",
  "REVIEWING",
  "DESIGNING",
  "APPROVED",
  "PRINTING",
  "QUALITY_CHECK",
  "PACKED",
  "SHIPPED",
  "DELIVERED"
] as const;

export function statusLabel(s: string): string {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function statusIndex(s: string): number {
  return ORDER_STATUS_STEPS.indexOf(s as (typeof ORDER_STATUS_STEPS)[number]);
}
