import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eraser,
  FolderOpen,
  Search,
  Terminal,
  X,
} from "lucide-react";

import type { LogEntry, LogLevel } from "../../common/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const LEVEL_STYLES: Record<LogLevel, string> = {
  info: "text-muted-foreground",
  warn: "text-warning",
  error: "text-destructive",
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
};

const SOURCE_STYLES: Record<string, string> = {
  main: "text-sky-400",
  renderer: "text-success",
  system: "text-warning",
};

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(
    d.getMilliseconds(),
    3,
  )}`;
}

export function LogsPanel({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [query, setQuery] = useState("");
  const [minLevel, setMinLevel] = useState<LogLevel>("info");
  const [autoScroll, setAutoScroll] = useState(true);
  const [filePath, setFilePath] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    window.electronAPI
      .getLogs()
      .then((logs) => {
        if (alive) setEntries(logs);
      })
      .catch(() => {});
    window.electronAPI
      .getLogFilePath()
      .then((p) => {
        if (alive) setFilePath(p);
      })
      .catch(() => {});

    const unsubscribe = window.electronAPI.onLog((entry) => {
      setEntries((prev) => {
        const next = [...prev, entry];
        return next.length > 1000 ? next.slice(next.length - 1000) : next;
      });
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [entries, autoScroll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank: Record<LogLevel, number> = { info: 0, warn: 1, error: 2 };
    return entries.filter((e) => {
      if (rank[e.level] < rank[minLevel]) return false;
      if (!q) return true;
      return (
        e.message.toLowerCase().includes(q) || e.source.toLowerCase().includes(q)
      );
    });
  }, [entries, query, minLevel]);

  const errorCount = entries.filter((e) => e.level === "error").length;

  const handleClear = useCallback(async () => {
    await window.electronAPI.clearLogs();
    setEntries([]);
  }, []);

  const handleReveal = useCallback(async () => {
    await window.electronAPI.revealLogFile();
  }, []);

  return (
    <section className="absolute inset-x-0 bottom-0 z-40 flex h-[55%] flex-col border-t border-border bg-card/95 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2">
        <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold">Logs</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {filtered.length}
        </span>
        {errorCount > 0 && (
          <span className="rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[11px] text-destructive">
            {errorCount} errors
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter logs…"
              className="h-7 w-40 pl-7 text-xs"
            />
          </div>

          {/* Level filter */}
          <div className="flex items-center gap-1 rounded-lg border border-input p-0.5 text-xs">
            {(["info", "warn", "error"] as LogLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setMinLevel(level)}
                className={`rounded-md px-2 py-1 font-medium transition-colors ${
                  minLevel === level
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {LEVEL_LABELS[level]}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleReveal}
            title="Open log file in Explorer"
            aria-label="Open log file in Explorer"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleClear}
            title="Clear logs"
            aria-label="Clear logs"
          >
            <Eraser className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setAutoScroll((v) => !v)}
            title={autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
            aria-label="Toggle auto-scroll"
            className={autoScroll ? "text-success" : undefined}
          >
            {autoScroll ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={onClose}
            title="Close logs"
            aria-label="Close logs"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Log file hint */}
      {filePath && (
        <div className="shrink-0 border-b border-border/40 bg-background/40 px-3 py-1 font-mono text-[11px] text-muted-foreground">
          {filePath}
        </div>
      )}

      {/* Entries */}
      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[11.5px] leading-relaxed"
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          if (atBottom !== autoScroll) setAutoScroll(atBottom);
        }}
      >
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No log entries yet.
          </div>
        ) : (
          filtered.map((entry) => (
            <div key={entry.id} className="flex gap-2 hover:bg-muted/30">
              <span className="shrink-0 text-muted-foreground/70">
                {formatTime(entry.timestamp)}
              </span>
              <span
                className={`w-16 shrink-0 ${SOURCE_STYLES[entry.source] ?? ""}`}
              >
                {entry.source}
              </span>
              <span
                className={`w-12 shrink-0 ${LEVEL_STYLES[entry.level]}`}
              >
                {LEVEL_LABELS[entry.level]}
              </span>
              <span className="min-w-0 flex-1 break-words whitespace-pre-wrap text-foreground/90">
                {entry.message}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}
