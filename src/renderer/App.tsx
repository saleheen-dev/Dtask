import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RotateCw,
  Trash2,
  XCircle,
  X,
  Check,
  CheckCircle2,
  Info,
  Sun,
  Moon,
  Monitor,
  Terminal,
  Crosshair,
  SearchIcon,
} from "lucide-react";
import appIcon from "../../resources/icon.png";
import type { ProcessInfo } from "../common/types";
import { useProcesses } from "./hooks/useProcesses";
import { useTheme } from "./hooks/useTheme";
import { ProcessTable } from "./components/ProcessTable";
import { ConfirmModal } from "./components/ConfirmModal";
import { KillByPort } from "./components/KillByPort";
import { LoadingState } from "./components/LoadingState";
import { EmptyState } from "./components/EmptyState";
import { LogsPanel } from "./components/LogsPanel";
import { ProcessLogsDialog } from "./components/ProcessLogsDialog";
import { ModeToggle } from "./components/mode-toggle";
import { Button } from "./components/ui/button";
import { Switch } from "./components/ui/switch";
import { Kbd, KbdGroup } from "./components/ui/kbd";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "./components/ui/input-group";
import { TooltipProvider } from "./components/ui/tooltip";
import { cn } from "./lib/utils";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from "./components/ui/command";

type ToastVariant = "error" | "success" | "info";

const TOAST_STYLES: Record<
  ToastVariant,
  { className: string; Icon: typeof Info }
> = {
  error: {
    className:
      "border-destructive/40 bg-destructive/10 text-destructive shadow-destructive/10",
    Icon: XCircle,
  },
  success: {
    className: "border-success/40 bg-success/10 text-success shadow-success/10",
    Icon: CheckCircle2,
  },
  info: {
    className: "border-border bg-card/95 text-foreground shadow-black/20",
    Icon: Info,
  },
};

function isSystemProcess(proc: ProcessInfo): boolean {
  if (proc.pid < 1000) return true;
  const lower = proc.name.toLowerCase();
  return lower.includes("system") || lower.includes("kernel");
}

function filterProcesses(
  processes: ProcessInfo[],
  query: string,
): ProcessInfo[] {
  if (!query.trim()) return processes;
  const q = query.trim().toLowerCase();
  return processes.filter((p) => {
    // PID: exact match or includes
    if (String(p.pid).includes(q)) return true;
    // Name: case-insensitive partial match
    if (p.name.toLowerCase().includes(q)) return true;
    // Port: exact match on any port
    if (p.ports.some((port) => String(port) === q)) return true;
    return false;
  });
}

export default function App() {
  const { theme, setTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [pendingKill, setPendingKill] = useState<ProcessInfo | null>(null);
  const [pendingBatchKill, setPendingBatchKill] = useState<
    ProcessInfo[] | null
  >(null);
  const [showKillByPort, setShowKillByPort] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set());
  const [showCmdline, setShowCmdline] = useState(false);
  const [groupByName, setGroupByName] = useState(false);
  const [suspendedPids, setSuspendedPids] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{
    message: string;
    variant: ToastVariant;
  } | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logProcess, setLogProcess] = useState<ProcessInfo | null>(null);

  const {
    processes,
    loading,
    refresh,
    killProcess,
    killMultiple,
    suspendProcess,
    resumeProcess,
    error,
    highlights,
  } = useProcesses({
    autoRefresh,
  });

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      setToast({ message, variant });
    },
    [],
  );

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!error) return;
    showToast(error, "error");
  }, [error, showToast]);

  // Keyboard shortcuts: Ctrl+R for refresh, Ctrl+K for kill-by-port, Ctrl+S for search focus, Escape to dismiss
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        refresh();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowKillByPort(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "l") {
        e.preventDefault();
        setShowLogs((v) => !v);
      }
      if (e.key === "Escape") {
        setSearch("");
        setPendingKill(null);
        setPendingBatchKill(null);
        setShowKillByPort(false);
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [refresh]);

  const filtered = useMemo(
    () => filterProcesses(processes, search),
    [processes, search],
  );

  const conflictingPorts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of processes) {
      for (const port of p.ports) {
        counts.set(port, (counts.get(port) ?? 0) + 1);
      }
    }
    const result = new Set<number>();
    for (const [port, count] of counts) {
      if (count > 1) result.add(port);
    }
    return result;
  }, [processes]);

  const handleKillClick = useCallback((proc: ProcessInfo) => {
    setPendingKill(proc);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearch("");
    searchRef.current?.focus();
  }, []);

  const handleSuspend = useCallback(
    async (proc: ProcessInfo) => {
      const ok = await suspendProcess(proc.pid);
      if (ok) {
        setSuspendedPids((prev) => new Set(prev).add(proc.pid));
      } else {
        showToast(
          `Failed to suspend ${proc.name} (PID ${proc.pid}). Try running as administrator.`,
          "error",
        );
      }
    },
    [suspendProcess, showToast],
  );

  const handleResume = useCallback(
    async (proc: ProcessInfo) => {
      const ok = await resumeProcess(proc.pid);
      if (ok) {
        setSuspendedPids((prev) => {
          const next = new Set(prev);
          next.delete(proc.pid);
          return next;
        });
      } else {
        showToast(`Failed to resume ${proc.name} (PID ${proc.pid}).`, "error");
      }
    },
    [resumeProcess, showToast],
  );

  const handleToggleSelect = useCallback((pid: number) => {
    setSelectedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    const visiblePids = filtered.map((p) => p.pid);
    setSelectedPids((prev) => {
      const allSelected = visiblePids.every((pid) => prev.has(pid));
      const next = new Set(prev);
      for (const pid of visiblePids) {
        if (allSelected) next.delete(pid);
        else next.add(pid);
      }
      return next;
    });
  }, [filtered]);

  const handleBatchKill = useCallback(() => {
    const selected = processes.filter((p) => selectedPids.has(p.pid));
    if (selected.length === 0) return;
    setPendingBatchKill(selected);
  }, [processes, selectedPids]);

  const handleBatchKillConfirm = useCallback(async () => {
    if (!pendingBatchKill) return;
    const pids = pendingBatchKill.map((p) => p.pid);
    setPendingBatchKill(null);
    setSelectedPids(new Set());
    await killMultiple(pids);
  }, [pendingBatchKill, killMultiple]);

  const handleKillByPortSubmit = useCallback(
    (portStr: string) => {
      const port = parseInt(portStr, 10);
      if (!Number.isFinite(port)) {
        showToast("Invalid port number", "error");
        return;
      }
      const found = processes.find((p) => p.ports.includes(port));
      if (!found) {
        showToast(`No process found on port ${port}`, "info");
        return;
      }
      setShowKillByPort(false);
      setPendingKill(found);
    },
    [processes],
  );

  const handleKillConfirm = useCallback(async () => {
    if (!pendingKill) return;
    const pid = pendingKill.pid;
    setPendingKill(null);
    await killProcess(pid);
  }, [pendingKill, killProcess]);

  const handleKillCancel = useCallback(() => {
    setPendingKill(null);
  }, []);

  useEffect(() => {
    const unsub = window.electronAPI.onShowKillByPort(() =>
      setShowKillByPort(true),
    );
    return unsub;
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        {/* Toast */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "absolute left-1/2 top-4 z-50 -translate-x-1/2 animate-fade-in rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-sm",
              TOAST_STYLES[toast.variant].className,
            )}
          >
            <span className="flex items-center gap-2">
              {(() => {
                const Icon = TOAST_STYLES[toast.variant].Icon;
                return <Icon className="h-4 w-4 shrink-0" />;
              })()}
              {toast.message}
            </span>
          </div>
        )}

        {/* Header */}
        <header className="shrink-0 border-b border-border/60 bg-card/80 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg sm:h-9 sm:w-9">
                <img src={appIcon} className="h-full w-full" alt="Dtask" />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Dtask
              </h1>
            </div>

            {/* Search + Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Search input */}
              <InputGroup className="w-36 sm:w-48 md:w-64 h-7">
                <InputGroupAddon align="inline-start">
                  <SearchIcon className="h-4 w-4" />
                </InputGroupAddon>
                <InputGroupInput
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by PID, name, or port…"
                />
                <InputGroupAddon align="inline-end">
                  {search ? (
                    <InputGroupButton
                      size="icon-xs"
                      variant="ghost"
                      onClick={handleClearSearch}
                      aria-label="Clear search"
                      title="Clear search"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </InputGroupButton>
                  ) : (
                    <KbdGroup>
                      <Kbd>Ctrl</Kbd>
                      <span>+</span>
                      <Kbd>S</Kbd>
                    </KbdGroup>
                  )}
                </InputGroupAddon>
              </InputGroup>

              {/* Logs */}
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setShowLogs((v) => !v)}
                aria-label="Toggle logs"
                title="Logs (Ctrl+Shift+L)"
                className={showLogs ? "border-success/50 text-success" : undefined}
              >
                <Terminal className="h-4 w-4" />
              </Button>

              {/* Theme toggle */}
              <ModeToggle />

              {/* Menu button (small screens) */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMenu(true)}
                className="lg:hidden mr-2"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              </Button>

              {/* Full controls (md+) */}
              <div className="hidden lg:flex lg:items-center lg:gap-2">
                {/* Manual refresh */}
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={refresh}
                  aria-label="Refresh process list"
                  title="Refresh (Ctrl+R)"
                >
                  <RotateCw className={loading ? "animate-spin" : ""} />
                </Button>

                {/* Batch kill */}
                {selectedPids.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBatchKill}
                  >
                    <Trash2 className="h-4 w-4" />
                    Kill Selected ({selectedPids.size})
                  </Button>
                )}

                {/* Kill by port */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowKillByPort(true)}
                  className="gap-1.5"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  <KbdGroup className="-mr-1">
                    <Kbd>Ctrl</Kbd>
                    <span>+</span>
                    <Kbd>K</Kbd>
                  </KbdGroup>
                </Button>

                {/* Group toggle */}
                <Button
                  variant={groupByName ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setGroupByName(!groupByName)}
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                  Group
                </Button>

                {/* Cmdline toggle */}
                <Button
                  variant={showCmdline ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setShowCmdline(!showCmdline)}
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                  Cmdline
                </Button>

                {/* Auto-refresh toggle */}
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 h-7 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground mr-2">
                  <span className="text-xs font-medium">Auto</span>
                  <Switch
                    checked={autoRefresh}
                    onCheckedChange={setAutoRefresh}
                    className="h-5"
                  />
                </label>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-5">
          {loading && processes.length === 0 ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <EmptyState
              message={
                search.trim()
                  ? `No processes matching "${search.trim()}"`
                  : "No processes found"
              }
            />
          ) : (
            <ProcessTable
              processes={filtered}
              onKill={handleKillClick}
              onViewLogs={setLogProcess}
              onSuspend={handleSuspend}
              onResume={handleResume}
              selectedPids={selectedPids}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              conflictingPorts={conflictingPorts}
              showCmdline={showCmdline}
              groupByName={groupByName}
              suspendedPids={suspendedPids}
              highlights={highlights}
            />
          )}
        </main>

        {/* Footer status */}
        <footer className="shrink-0 border-t border-border/60 bg-card/50 px-6 py-2">
          <p className="text-xs text-muted-foreground">
            {filtered.length} process{filtered.length !== 1 ? "es" : ""}
            {search.trim() && ` of ${processes.length} total`}
            {suspendedPids.size > 0 && ` · ${suspendedPids.size} suspended`}
            {autoRefresh && " · Auto-refreshing every 3s"}
          </p>
        </footer>

        {/* Kill confirmation modal */}
        {pendingKill && (
          <ConfirmModal
            pid={pendingKill.pid}
            name={pendingKill.name}
            isSystemProcess={isSystemProcess(pendingKill)}
            onConfirm={handleKillConfirm}
            onCancel={handleKillCancel}
          />
        )}

        {/* Batch kill confirmation modal */}
        {pendingBatchKill && (
          <ConfirmModal
            pid={0}
            name=""
            isSystemProcess={false}
            count={pendingBatchKill.length}
            onConfirm={handleBatchKillConfirm}
            onCancel={() => setPendingBatchKill(null)}
          />
        )}

        {/* Kill-by-port dialog */}
        {showKillByPort && (
          <KillByPort
            onSubmit={handleKillByPortSubmit}
            onCancel={() => setShowKillByPort(false)}
          />
        )}

        {/* Per-process log viewer */}
        {logProcess && (
          <ProcessLogsDialog
            proc={logProcess}
            onClose={() => setLogProcess(null)}
            onRestarted={(message) => {
              showToast(message, "success");
              void refresh();
            }}
          />
        )}

        {/* In-app log viewer */}
        {showLogs && <LogsPanel onClose={() => setShowLogs(false)} />}

        {/* Responsive menu (small screens) */}
        <CommandDialog open={showMenu} onOpenChange={setShowMenu}>
          <CommandInput placeholder="Search actions…" />
          <CommandList>
            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => {
                  refresh();
                  setShowMenu(false);
                }}
              >
                <RotateCw className="h-4 w-4" />
                Refresh
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setShowKillByPort(true);
                  setShowMenu(false);
                }}
              >
                <Crosshair className="h-4 w-4" />
                Kill by Port
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setGroupByName(!groupByName);
                  setShowMenu(false);
                }}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                  <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                  <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
                {groupByName ? "Ungroup" : "Group by Executable"}
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setShowCmdline(!showCmdline);
                  setShowMenu(false);
                }}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
                {showCmdline ? "Hide" : "Show"} Command Line
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setAutoRefresh(!autoRefresh);
                  setShowMenu(false);
                }}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Auto-refresh: {autoRefresh ? "On" : "Off"}
              </CommandItem>
            </CommandGroup>
            <CommandItem
              onSelect={() => {
                setShowLogs(true);
                setShowMenu(false);
              }}
            >
              <Terminal className="h-4 w-4" />
              Show Logs
            </CommandItem>
            <CommandGroup heading="Theme">
              <CommandItem
                onSelect={() => {
                  setTheme("light");
                  setShowMenu(false);
                }}
              >
                <Sun className="h-4 w-4" />
                Light
                {theme === "light" && <Check className="ml-auto h-4 w-4" />}
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setTheme("dark");
                  setShowMenu(false);
                }}
              >
                <Moon className="h-4 w-4" />
                Dark
                {theme === "dark" && <Check className="ml-auto h-4 w-4" />}
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setTheme("system");
                  setShowMenu(false);
                }}
              >
                <Monitor className="h-4 w-4" />
                System
                {theme === "system" && <Check className="ml-auto h-4 w-4" />}
              </CommandItem>
            </CommandGroup>
            {selectedPids.size > 0 && (
              <CommandGroup heading="Selection">
                <CommandItem
                  onSelect={() => {
                    handleBatchKill();
                    setShowMenu(false);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Kill Selected ({selectedPids.size})
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </CommandDialog>
      </div>
    </TooltipProvider>
  );
}
