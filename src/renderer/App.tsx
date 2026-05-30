import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RotateCw, Trash2, XCircle, Download } from "lucide-react";
import appIcon from "../../resources/icon.png";
import type { ProcessInfo } from "../common/types";
import { useProcesses } from "./hooks/useProcesses";
import { ProcessTable } from "./components/ProcessTable";
import { ConfirmModal } from "./components/ConfirmModal";
import { KillByPort } from "./components/KillByPort";
import { LoadingState } from "./components/LoadingState";
import { EmptyState } from "./components/EmptyState";

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
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [pendingKill, setPendingKill] = useState<ProcessInfo | null>(null);
  const [pendingBatchKill, setPendingBatchKill] = useState<ProcessInfo[] | null>(null);
  const [showKillByPort, setShowKillByPort] = useState(false);
  const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set());
  const [showCmdline, setShowCmdline] = useState(false);
  const [groupByName, setGroupByName] = useState(false);
  const [suspendedPids, setSuspendedPids] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const { processes, loading, refresh, killProcess, killMultiple, suspendProcess, resumeProcess, error, highlights } = useProcesses({
    autoRefresh,
  });

  // Auto-dismiss error toast after 3 seconds
  useEffect(() => {
    if (!error) return;
    setToast(error);
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [error]);

  // Keyboard shortcuts: Cmd/Ctrl+R for refresh, Cmd/Ctrl+K for kill-by-port, Escape to dismiss
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
      if (e.key === "Escape") {
        setSearch("");
        setPendingKill(null);
        setPendingBatchKill(null);
        setShowKillByPort(false);
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

  const handleSuspend = useCallback(async (proc: ProcessInfo) => {
    const ok = await suspendProcess(proc.pid);
    if (ok) {
      setSuspendedPids(prev => new Set(prev).add(proc.pid));
    } else {
      setToast(`Failed to suspend ${proc.name} (PID ${proc.pid}). Try running as administrator.`);
    }
  }, [suspendProcess]);

  const handleResume = useCallback(async (proc: ProcessInfo) => {
    const ok = await resumeProcess(proc.pid);
    if (ok) {
      setSuspendedPids(prev => {
        const next = new Set(prev);
        next.delete(proc.pid);
        return next;
      });
    } else {
      setToast(`Failed to resume ${proc.name} (PID ${proc.pid}).`);
    }
  }, [resumeProcess]);

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
        setToast("Invalid port number");
        return;
      }
      const found = processes.find((p) => p.ports.includes(port));
      if (!found) {
        setToast(`No process found on port ${port}`);
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

  const handleExportCsv = useCallback(() => {
    const headers = "PID,Name,Ports,Protocol,Address,Command Line";
    const rows = filtered.map(p => {
      const cmd = p.cmdline ? `"${p.cmdline.replace(/"/g, '""')}"` : "";
      return `${p.pid},"${p.name}","${p.ports.join('; ')}",${p.protocol},${p.address ?? ""},${cmd}`;
    });
    const csv = [headers, ...rows].join("\n");
    try {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dtask-processes-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setToast("CSV exported");
    } catch {
      setToast("Failed to export CSV");
    }
  }, [filtered]);

  useEffect(() => {
    const unsub = window.electronAPI.onShowKillByPort(() => setShowKillByPort(true));
    return unsub;
  }, []);

  const btnBase = "flex h-9 items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900 px-3 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40";
  const btnActive = `${btnBase} border-emerald-500/40 text-emerald-400 hover:border-emerald-500/60 hover:text-emerald-300`;
  const btnInactive = `${btnBase} text-gray-400 hover:border-gray-600 hover:text-white`;

  return (
    <div className="flex h-screen flex-col bg-gray-900 text-white">
      {/* Error toast */}
      {toast && (
        <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2 animate-fade-in rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 shadow-lg backdrop-blur-sm">
          <span className="flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" />
            {toast}
          </span>
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 border-b border-gray-700/60 bg-gray-800/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg">
              <img src={appIcon} className="h-full w-full" alt="Dtask" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Dtask
            </h1>
          </div>

          {/* Search + Controls */}
          <div className="flex items-center gap-3">
            {/* Search input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by PID, name, or port…"
                className="h-9 w-64 rounded-lg border border-gray-700 bg-gray-900 pl-9 pr-3 text-sm text-white placeholder-gray-500 transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              />
            </div>

            {/* Manual refresh */}
            <button
              onClick={refresh}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-700 bg-gray-900 text-gray-400 transition-colors hover:border-gray-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              aria-label="Refresh process list"
              title="Refresh (Ctrl+R)"
            >
              <RotateCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>

            {/* Batch kill */}
            {selectedPids.size > 0 && (
              <button
                onClick={handleBatchKill}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-400 transition-colors hover:border-red-500/60 hover:bg-red-500/20 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/50"
              >
                <Trash2 className="h-4 w-4" />
                Kill Selected ({selectedPids.size})
              </button>
            )}

            {/* Group toggle */}
            <button
              onClick={() => setGroupByName(!groupByName)}
              className={groupByName ? btnActive : btnInactive}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
              Group
            </button>

            {/* Cmdline toggle */}
            <button
              onClick={() => setShowCmdline(!showCmdline)}
              className={showCmdline ? btnActive : btnInactive}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
              </svg>
              Cmdline
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCsv}
              className={btnInactive}
              title="Export CSV"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>

            {/* Auto-refresh toggle */}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:border-gray-600 hover:text-white">
              <span className="text-xs font-medium">Auto</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="h-5 w-9 rounded-full bg-gray-700 transition-colors peer-checked:bg-emerald-500/70" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
              </div>
            </label>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-6 py-5">
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
      <footer className="shrink-0 border-t border-gray-700/60 bg-gray-800/50 px-6 py-2">
        <p className="text-xs text-gray-500">
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
    </div>
  );
}
