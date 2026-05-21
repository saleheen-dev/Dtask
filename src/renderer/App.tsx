import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Search, RotateCw, XCircle } from 'lucide-react'
import type { ProcessInfo } from '../common/types'
import { useProcesses } from './hooks/useProcesses'
import { ProcessTable } from './components/ProcessTable'
import { ConfirmModal } from './components/ConfirmModal'
import { LoadingState } from './components/LoadingState'
import { EmptyState } from './components/EmptyState'

function isSystemProcess(proc: ProcessInfo): boolean {
  if (proc.pid < 1000) return true
  const lower = proc.name.toLowerCase()
  return lower.includes('system') || lower.includes('kernel')
}

function filterProcesses(processes: ProcessInfo[], query: string): ProcessInfo[] {
  if (!query.trim()) return processes
  const q = query.trim().toLowerCase()
  return processes.filter((p) => {
    // PID: exact match or includes
    if (String(p.pid).includes(q)) return true
    // Name: case-insensitive partial match
    if (p.name.toLowerCase().includes(q)) return true
    // Port: exact match on any port
    if (p.ports.some((port) => String(port) === q)) return true
    return false
  })
}

export default function App() {
  const [search, setSearch] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [pendingKill, setPendingKill] = useState<ProcessInfo | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const { processes, loading, refresh, killProcess, error } = useProcesses({ autoRefresh })

  // Auto-dismiss error toast after 3 seconds
  useEffect(() => {
    if (!error) return
    setToast(error)
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [error])

  // Keyboard shortcuts: Ctrl/Cmd+R for refresh, Escape to clear search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault()
        refresh()
      }
      if (e.key === 'Escape') {
        setSearch('')
        setPendingKill(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [refresh])

  const filtered = useMemo(() => filterProcesses(processes, search), [processes, search])

  const handleKillClick = useCallback((proc: ProcessInfo) => {
    setPendingKill(proc)
  }, [])

  const handleKillConfirm = useCallback(async () => {
    if (!pendingKill) return
    await killProcess(pendingKill.pid)
    setPendingKill(null)
  }, [pendingKill, killProcess])

  const handleKillCancel = useCallback(() => {
    setPendingKill(null)
  }, [])

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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15">
              <Activity className="h-5 w-5 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Task Killer</h1>
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
              <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
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
                : 'No processes found'
            }
          />
        ) : (
          <ProcessTable processes={filtered} onKill={handleKillClick} />
        )}
      </main>

      {/* Footer status */}
      <footer className="shrink-0 border-t border-gray-700/60 bg-gray-800/50 px-6 py-2">
        <p className="text-xs text-gray-500">
          {filtered.length} process{filtered.length !== 1 ? 'es' : ''}
          {search.trim() && ` of ${processes.length} total`}
          {autoRefresh && ' · Auto-refreshing every 3s'}
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
    </div>
  )
}
