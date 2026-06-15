import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "muted";

const variants: Record<BadgeVariant, string> = {
  default: "bg-bg-elevated text-white border-border",
  accent: "bg-accent/15 text-accent border-accent/30",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  danger: "bg-red-500/15 text-red-300 border-red-500/30",
  muted: "bg-bg-soft text-muted border-border",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

const statusMap: Record<string, BadgeVariant> = {
  ready: "success",
  processing: "accent",
  queued: "warning",
  uploading: "accent",
  created: "muted",
  failed: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  const variant = statusMap[status] ?? "muted";
  return (
    <Badge variant={variant} className="uppercase tracking-wider">
      {variant === "accent" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {status}
    </Badge>
  );
}
