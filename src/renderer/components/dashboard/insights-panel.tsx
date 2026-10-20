import { useMemo } from "react";
import { Activity, Layers, Network, TriangleAlert } from "lucide-react";

import type { ProcessInfo } from "../../../common/types";
import { cn } from "../../lib/utils";
import { Panel } from "./panel";

interface InsightsPanelProps {
  processes: ProcessInfo[];
  conflictingPorts: Set<number>;
  suspendedPids: ReadonlySet<number>;
  highlights: ReadonlyMap<number, "added">;
  onSelectProcess: (proc: ProcessInfo) => void;
}

interface BarRow {
  label: string;
  value: number;
  detail?: string;
}

function BarList({
  rows,
  tone = "default",
  onSelect,
}: {
  rows: BarRow[];
  tone?: "default" | "success" | "warning";
  onSelect?: (label: string) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const barColor =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : "bg-primary";

  if (rows.length === 0) {
    return (
      <p className="py-4 text-center text-[11px] text-muted-foreground">
        Nothing to show yet.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.label}>
          <button
            type="button"
            onClick={() => onSelect?.(row.label)}
            disabled={!onSelect}
            className={cn(
              "w-full cursor-pointer text-left",
              onSelect &&
                "rounded-md px-1 py-0.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-mono text-[11px] text-foreground/90">
                {row.label}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {row.detail ?? row.value}
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-[width] duration-300", barColor)}
                style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
              />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Right-hand insight column of the dashboard: what is using ports,
 * how protocols split, which ports clash and what just appeared.
 */
export function InsightsPanel({
  processes,
  conflictingPorts,
  suspendedPids,
  highlights,
  onSelectProcess,
}: InsightsPanelProps) {
  const { portHogs, protocolSplit, conflicts, newcomers } = useMemo(() => {
    // Processes owning the most ports.
    const byPorts = [...processes]
      .filter((p) => p.ports.length > 0)
      .sort((a, b) => b.ports.length - a.ports.length)
      .slice(0, 6)
      .map((p) => ({
        label: p.name,
        value: p.ports.length,
        detail: `${p.ports.length} port${p.ports.length === 1 ? "" : "s"}`,
      }));

    // Protocol distribution.
    const counts = new Map<string, number>();
    for (const p of processes) {
      const key = p.protocol || "—";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const split = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));

    // Ports owned by more than one process.
    const owners = new Map<number, ProcessInfo[]>();
    for (const p of processes) {
      for (const port of p.ports) {
        const list = owners.get(port) ?? [];
        list.push(p);
        owners.set(port, list);
      }
    }
    const clashRows: BarRow[] = [...owners.entries()]
      .filter(([, list]) => list.length > 1)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 6)
      .map(([port, list]) => ({
        label: `:${port}`,
        value: list.length,
        detail: `${list.length} processes`,
      }));

    // Processes that appeared since the last refresh.
    const fresh = processes.filter((p) => highlights.has(p.pid));

    return {
      portHogs: byPorts,
      protocolSplit: split,
      conflicts: clashRows,
      newcomers: fresh,
    };
  }, [processes, highlights]);

  const totalPorts = processes.reduce((sum, p) => sum + p.ports.length, 0);
  const total = Math.max(1, processes.length);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* Protocol split */}
      <Panel title="Protocol split" icon={Network}>
        {protocolSplit.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-muted-foreground">
            No processes detected yet.
          </p>
        ) : (
          <>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              {protocolSplit.map((entry, index) => (
                <div
                  key={entry.label}
                  className={cn(
                    "h-full transition-[width] duration-300",
                    index === 0 ? "bg-success" : index === 1 ? "bg-suspended" : "bg-primary",
                  )}
                  style={{ width: `${(entry.value / total) * 100}%` }}
                  title={`${entry.label}: ${entry.value}`}
                />
              ))}
            </div>
            <ul className="mt-3 space-y-1.5">
              {protocolSplit.map((entry, index) => (
                <li
                  key={entry.label}
                  className="flex items-center justify-between gap-2 text-[11px]"
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-2 w-2 rounded-full",
                        index === 0
                          ? "bg-success"
                          : index === 1
                            ? "bg-suspended"
                            : "bg-primary",
                      )}
                    />
                    {entry.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {entry.value} · {Math.round((entry.value / total) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              {totalPorts} listening port{totalPorts === 1 ? "" : "s"} across{" "}
              {processes.length} process{processes.length === 1 ? "" : "es"}
            </p>
          </>
        )}
      </Panel>

      {/* Port pressure */}
      <Panel title="Most ports" icon={Layers}>
        <BarList
          rows={portHogs}
          onSelect={(label) => {
            const proc = processes.find((p) => p.name === label);
            if (proc) onSelectProcess(proc);
          }}
        />
      </Panel>

      {/* Conflicts */}
      <Panel title="Port conflicts" icon={TriangleAlert}>
        {conflicts.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-muted-foreground">
            No shared ports detected.
          </p>
        ) : (
          <>
            <BarList rows={conflicts} tone="warning" />
            <p className="mt-3 border-t border-border/60 pt-2 text-[11px] text-warning">
              {conflictingPorts.size} port
              {conflictingPorts.size === 1 ? "" : "s"} bound by more than one
              process.
            </p>
          </>
        )}
      </Panel>

      {/* Recent activity */}
      <Panel title="Just appeared" icon={Activity}>
        {newcomers.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-muted-foreground">
            No new processes since the last refresh.
          </p>
        ) : (
          <ul className="space-y-1">
            {newcomers.slice(0, 6).map((p) => (
              <li key={p.pid}>
                <button
                  type="button"
                  onClick={() => onSelectProcess(p)}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate text-[11px] text-foreground/90">
                    {p.name}
                  </span>
                  <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                    PID {p.pid}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {suspendedPids.size > 0 && (
          <p className="mt-3 border-t border-border/60 pt-2 text-[11px] text-suspended">
            {suspendedPids.size} process{suspendedPids.size === 1 ? "" : "es"}{" "}
            suspended.
          </p>
        )}
      </Panel>
    </div>
  );
}
