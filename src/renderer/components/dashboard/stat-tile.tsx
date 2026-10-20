import type { LucideIcon } from "lucide-react";

import { cn } from "../../lib/utils";

export type StatTone = "default" | "success" | "warning" | "destructive" | "info";

const TONE_ICON: Record<StatTone, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-suspended",
};

const TONE_ACCENT: Record<StatTone, string> = {
  default: "bg-muted-foreground/40",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-suspended",
};

interface StatTileProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: StatTone;
  hint?: string;
  className?: string;
}

/**
 * Compact KPI tile for the dashboard row.
 * Dense by design: label + value + one supporting line.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "group relative flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl border border-border bg-card/70 p-3 transition-colors duration-200 hover:border-ring/40 hover:bg-card",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-200 group-hover:opacity-100",
          TONE_ACCENT[tone],
        )}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", TONE_ICON[tone])} aria-hidden="true" />
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold leading-none tracking-tight tabular-nums">
          {value}
        </span>
        {hint && (
          <span className="truncate text-[11px] text-muted-foreground">{hint}</span>
        )}
      </div>
    </div>
  );
}
