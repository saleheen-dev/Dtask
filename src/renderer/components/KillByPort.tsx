import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleSlash,
  Network,
  TriangleAlert,
} from "lucide-react";

import type { ProcessInfo } from "../../common/types";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface KillByPortProps {
  processes: ProcessInfo[];
  onSelect: (proc: ProcessInfo) => void;
  onCancel: () => void;
}

export function KillByPort({ processes, onSelect, onCancel }: KillByPortProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const query = value.trim();
  const portNumber = /^\d+$/.test(query) ? Number(query) : null;

  /* Exact matches for the entered port, plus nearby ports for partial input. */
  const { matches, nearby } = useMemo(() => {
    if (!query) return { matches: [] as ProcessInfo[], nearby: [] as ProcessInfo[] };

    if (portNumber !== null) {
      const exact = processes.filter((p) => p.ports.includes(portNumber));
      const partial = processes.filter(
        (p) =>
          !p.ports.includes(portNumber) &&
          p.ports.some((port) => String(port).startsWith(query)),
      );
      return { matches: exact, nearby: partial };
    }

    // Non-numeric input: match by process name / pid
    const needle = query.toLowerCase();
    const byName = processes.filter((p) => p.name.toLowerCase().includes(needle));
    return { matches: [], nearby: byName.slice(0, 6) };
  }, [processes, query, portNumber]);

  const isFree = portNumber !== null && matches.length === 0 && nearby.length === 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
      return;
    }
    if (e.key === "Enter" && matches.length === 1) {
      onSelect(matches[0]);
    }
  };

  return (
    <Dialog open onClose={onCancel} className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Network className="h-4 w-4" aria-hidden="true" />
          Kill by port
        </DialogTitle>
        <DialogDescription>
          Enter a port number to find the process holding it, then kill it.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4">
        <div className="relative">
          <Network
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. 3000"
            inputMode="numeric"
            aria-label="Port number"
            className="pl-8 font-mono"
          />
        </div>

        {/* Live result */}
        <div className="mt-3 min-h-[132px] rounded-lg border border-border bg-background/60 p-3">
          {!query ? (
            <p className="flex h-full items-center justify-center text-center text-[11px] text-muted-foreground">
              Type a port to see which process is listening on it.
            </p>
          ) : (
            <div className="space-y-2">
              {matches.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {matches.length === 1
                      ? "Process on this port"
                      : `${matches.length} processes on this port`}
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {matches.map((proc) => (
                      <li
                        key={proc.pid}
                        className="flex items-center gap-2 rounded-md border border-border/70 bg-card/60 px-2 py-1.5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">
                            {proc.name}
                          </span>
                          <span className="block font-mono text-[10.5px] text-muted-foreground">
                            PID {proc.pid} · {proc.protocol}
                            {proc.address ? ` · ${proc.address}` : ""}
                          </span>
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onSelect(proc)}
                          aria-label={`Kill ${proc.name} (PID ${proc.pid})`}
                        >
                          Kill
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {matches.length > 1 && (
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-warning">
                      <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      This port is shared by multiple processes — pick one.
                    </p>
                  )}
                </div>
              )}

              {isFree && (
                <p className="flex items-center gap-2 text-[11px] text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Port {portNumber} is free — nothing is listening on it.
                </p>
              )}

              {portNumber !== null && matches.length === 0 && nearby.length > 0 && (
                <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <CircleSlash className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Nothing is listening on port {portNumber} — showing similar
                  ports below.
                </p>
              )}

              {nearby.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {portNumber !== null ? "Nearby ports" : "Matching processes"}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {nearby.map((proc) => (
                      <li
                        key={proc.pid}
                        className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 px-2 py-1 transition-colors hover:bg-accent"
                      >
                        <span className="min-w-0 flex-1 truncate text-[11px]">
                          {proc.name}
                        </span>
                        <span className="shrink-0 truncate font-mono text-[10.5px] text-muted-foreground">
                          {proc.ports
                            .filter((p) =>
                              portNumber !== null
                                ? String(p).startsWith(query)
                                : true,
                            )
                            .slice(0, 6)
                            .join(", ")}
                        </span>
                        <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                          PID {proc.pid}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSelect(proc)}
                          className="h-6 shrink-0 px-2 text-[11px]"
                        >
                          Kill
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={() => matches.length === 1 && onSelect(matches[0])}
          disabled={matches.length !== 1}
          className={cn(matches.length === 1 && "min-w-[150px]")}
        >
          {matches.length === 1
            ? `Kill ${matches[0].name.slice(0, 14)}`
            : matches.length > 1
              ? "Select a process"
              : "Kill"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
