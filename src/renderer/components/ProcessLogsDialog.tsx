import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  RotateCcw,
  ScrollText,
  TriangleAlert,
} from "lucide-react";

import type {
  ProcessInfo,
  ProcessLogCandidate,
  ProcessLogFile,
  ProcessLogTarget,
} from "../../common/types";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function ProcessLogsDialog({
  proc,
  onClose,
  onRestarted,
}: {
  proc: ProcessInfo;
  onClose: () => void;
  onRestarted?: (message: string) => void;
}) {
  const [target, setTarget] = useState<ProcessLogTarget | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRestart, setShowRestart] = useState(false);
  const [restartPid, setRestartPid] = useState<number | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [restartMessage, setRestartMessage] = useState<string | null>(null);
  const [restartDir, setRestartDir] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadTarget = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.getProcessLogTarget(proc.pid);
      setTarget(result);
      setSelected(result.files[0]?.path ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to inspect process");
    } finally {
      setLoading(false);
    }
  }, [proc.pid]);

  useEffect(() => {
    void loadTarget();
  }, [loadTarget]);

  // Load + tail the selected file
  useEffect(() => {
    let alive = true;
    if (!selected) {
      setLines([]);
      return;
    }

    void (async () => {
      const content = await window.electronAPI.readProcessLog(selected);
      if (!alive) return;
      setLines(content);
      await window.electronAPI.watchProcessLog(selected);
    })();

    const unsubscribe = window.electronAPI.onProcessLogChunk((payload) => {
      if (payload.path !== selected) return;
      setLines((prev) => {
        const next = [...prev, ...payload.lines];
        return next.length > 2000 ? next.slice(next.length - 2000) : next;
      });
    });

    return () => {
      alive = false;
      unsubscribe();
      void window.electronAPI.unwatchProcessLog(selected);
    };
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  /** Restartable commands: the process itself plus its ancestors (skip plain shells). */
  const restartCandidates = useMemo<ProcessLogCandidate[]>(() => {
    const chain = target?.chain ?? [];
    return chain.filter(
      (c) =>
        c.commandLine.trim() &&
        !/^(cmd|powershell|pwsh|conhost)\.exe$/i.test(c.name),
    );
  }, [target]);

  // Default to the top-most restartable command (the real entry point).
  useEffect(() => {
    if (restartCandidates.length === 0 || restartPid !== null) return;
    const preferred =
      restartCandidates.find((c) => c.restartable) ??
      restartCandidates[restartCandidates.length - 1];
    setRestartPid(preferred.pid);
  }, [restartCandidates, restartPid]);

  // Keep the working directory in sync with the selected command.
  useEffect(() => {
    const candidate = restartCandidates.find((c) => c.pid === restartPid);
    setRestartDir(candidate?.workingDir ?? "");
  }, [restartCandidates, restartPid]);

  const handleRestart = useCallback(async () => {
    if (!restartPid) return;
    setRestarting(true);
    setRestartMessage(null);
    try {
      const result = await window.electronAPI.restartProcess(
        restartPid,
        selected ?? undefined,
        restartDir.trim() || undefined,
      );
      setRestartMessage(result.message);
      if (result.success) {
        onRestarted?.(result.message);
        await loadTarget();
      }
    } catch (err) {
      setRestartMessage(err instanceof Error ? err.message : "Restart failed");
    } finally {
      setRestarting(false);
    }
  }, [restartPid, selected, restartDir, onRestarted, loadTarget]);

  return (
    <Dialog open onClose={onClose} className="max-w-3xl">
      <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Logs — {proc.name} (PID {proc.pid})
          </DialogTitle>
          <DialogDescription>
            {target?.commandLine ? (
              <span className="block break-all font-mono text-[11px]">
                {target.commandLine}
              </span>
            ) : (
              "Inspecting the process…"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-3">
          {/* Candidate files */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Log files found:
            </span>
            {loading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
            {!loading && (target?.files.length ?? 0) === 0 && (
              <span className="text-xs text-muted-foreground">
                none — this process writes to the terminal, not to a file
              </span>
            )}
            {target?.files.map((file: ProcessLogFile) => (
              <button
                key={file.path}
                onClick={() => setSelected(file.path)}
                title={file.path}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] transition-colors ${
                  selected === file.path
                    ? "border-success/50 bg-success/10 text-success"
                    : "border-input text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-3 w-3" />
                {file.path.split(/[\\/]/).pop()}
                <span className="opacity-60">
                  {formatSize(file.size)} · {formatTime(file.modified)}
                </span>
              </button>
            ))}
            <Button
              variant="outline"
              size="icon-sm"
              onClick={loadTarget}
              title="Rescan for log files"
              aria-label="Rescan for log files"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setShowRestart((v) => !v)}
              title="Restart this command"
              aria-label="Restart this command"
              className={showRestart ? "border-success/50 text-success" : undefined}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            {selected && (
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => window.electronAPI.revealProcessLog(selected)}
                title="Reveal in Explorer"
                aria-label="Reveal in Explorer"
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Restart panel */}
          {showRestart && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-warning">
                    Restart this command
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    The process tree is killed and the same command is re-run in
                    its working directory. Output is appended to the log file you
                    are viewing.
                  </p>

                  {restartCandidates.length === 0 ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      No restartable command found for this process.
                    </p>
                  ) : (
                    <>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select
                        value={restartPid ?? ""}
                        onChange={(e) => setRestartPid(Number(e.target.value))}
                        className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-[11px] text-foreground"
                      >
                        {restartCandidates.map((c) => (
                          <option key={c.pid} value={c.pid}>
                            [{c.pid}] {c.name}
                            {c.restartable ? "" : " (no working dir)"} —{" "}
                            {c.commandLine.slice(0, 90)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        value={restartDir}
                        onChange={(e) => setRestartDir(e.target.value)}
                        placeholder="Working directory (e.g. D:\\project)"
                        className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleRestart}
                        disabled={restarting || !restartPid}
                      >
                        {restarting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        Restart
                      </Button>
                    </div>
                    </>
                  )}

                  {restartMessage && (
                    <p
                      className={`mt-2 break-words font-mono text-[11px] ${
                        restartMessage.startsWith("Failed") ||
                        restartMessage.startsWith("Refusing") ||
                        restartMessage.startsWith("Invalid") ||
                        restartMessage.startsWith("No command")
                          ? "text-destructive"
                          : "text-success"
                      }`}
                    >
                      {restartMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <div
            ref={scrollRef}
            className="h-[45vh] overflow-y-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-[11.5px] leading-relaxed"
          >
            {error ? (
              <div className="text-destructive">{error}</div>
            ) : !selected ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                {loading
                  ? "Looking for log files…"
                  : "No log file found for this process."}
              </div>
            ) : lines.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Log file is empty.
              </div>
            ) : (
              lines.map((line, i) => (
                <div
                  key={`${i}-${line.slice(0, 12)}`}
                  className="whitespace-pre-wrap break-words text-foreground/85"
                >
                  {line || " "}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {target?.workingDir && (
            <div className="truncate font-mono text-[11px] text-muted-foreground">
              {target.workingDir}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
    </Dialog>
  );
}
