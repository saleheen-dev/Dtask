import { ChevronDown, ChevronRight, ChevronUp, Pause, Play, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { ProcessInfo } from '../../common/types'

type SortKey = 'pid' | 'name' | 'ports' | 'protocol'
type SortDir = 'asc' | 'desc'

interface ProcessTableProps {
  processes: ProcessInfo[]
  onKill: (process: ProcessInfo) => void
  onSuspend: (process: ProcessInfo) => void
  onResume: (process: ProcessInfo) => void
  selectedPids: Set<number>
  onToggleSelect: (pid: number) => void
  onToggleSelectAll: () => void
  conflictingPorts: Set<number>
  showCmdline: boolean
  groupByName: boolean
  suspendedPids: ReadonlySet<number>
  highlights: ReadonlyMap<number, 'added'>
}

function isSystemProcess(process: ProcessInfo): boolean {
  if (process.pid < 1000) return true
  const lower = process.name.toLowerCase()
  return lower.includes('system') || lower.includes('kernel')
}

function compareValues(a: ProcessInfo, b: ProcessInfo, key: SortKey): number {
  switch (key) {
    case 'pid':
      return a.pid - b.pid
    case 'name':
      return a.name.localeCompare(b.name)
    case 'ports': {
      const aMax = a.ports.length > 0 ? Math.max(...a.ports) : -1
      const bMax = b.ports.length > 0 ? Math.max(...b.ports) : -1
      return aMax - bMax
    }
    case 'protocol':
      return a.protocol.localeCompare(b.protocol)
  }
}

export function ProcessTable({ processes, onKill, onSuspend, onResume, selectedPids, onToggleSelect, onToggleSelectAll, conflictingPorts, showCmdline, groupByName, suspendedPids, highlights }: ProcessTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('pid')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortDir('asc')
      }
      return key
    })
  }, [])

  const sorted = useMemo(() => {
    const copy = [...processes]
    copy.sort((a, b) => {
      const cmp = compareValues(a, b, sortKey)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [processes, sortKey, sortDir])

  const groups = useMemo(() => {
    if (!groupByName) return null
    const g = new Map<string, ProcessInfo[]>()
    for (const p of sorted) {
      const arr = g.get(p.name) ?? []
      arr.push(p)
      g.set(p.name, arr)
    }
    return Array.from(g.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [sorted, groupByName])

  const toggleGroup = useCallback((name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const allSelected = processes.length > 0 && processes.every(p => selectedPids.has(p.pid))

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (column !== sortKey) {
      return <span className="ml-1 inline-block h-4 w-4 opacity-0 group-hover:opacity-30" />
    }
    return sortDir === 'asc' ? (
      <ChevronUp className="ml-1 inline-block h-4 w-4 text-emerald-400" />
    ) : (
      <ChevronDown className="ml-1 inline-block h-4 w-4 text-emerald-400" />
    )
  }

  const headerClass =
    'group cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 transition-colors hover:text-white'

  const cellClass = 'px-4 py-3 text-sm'

  const renderProcessRow = (proc: ProcessInfo, indented = false) => {
    const sys = isSystemProcess(proc)
    const conflict = proc.ports.some(p => conflictingPorts.has(p))
    const suspended = suspendedPids.has(proc.pid)
    const added = highlights.get(proc.pid)
    const hlClass = added === 'added' ? 'animate-pulse bg-emerald-500/10 border-l-2 border-l-emerald-400' : ''
    return (
      <tr
        key={proc.pid}
        className={`border-b border-gray-700/50 transition-colors last:border-b-0 hover:bg-gray-700/50 ${conflict ? 'bg-amber-500/5' : ''} ${hlClass}`}
      >
        <td className={`${cellClass} ${indented ? 'pl-10' : 'px-4'}`}>
          <input
            type="checkbox"
            checked={selectedPids.has(proc.pid)}
            onChange={() => onToggleSelect(proc.pid)}
            className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500/30"
          />
        </td>
        <td className={`${cellClass} font-mono text-gray-300`}>{proc.pid}</td>
        <td className={`${cellClass} text-white`}>
          <span className="flex items-center gap-2">
            {conflict && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
            {suspended && <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />}
            <span className="truncate max-w-[180px]" title={proc.name}>{proc.name}</span>
            {suspended && (
              <span className="rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-400">
                Suspended
              </span>
            )}
            {sys && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                System
              </span>
            )}
          </span>
        </td>
        <td className={`${cellClass} font-mono text-gray-300`}>
          {proc.ports.length > 0 ? proc.ports.join(', ') : '—'}
        </td>
        <td className={`${cellClass} text-gray-400`}>{proc.protocol}</td>
        {showCmdline && (
          <td className={`${cellClass} max-w-[300px] text-gray-400`}>
            <span className="block truncate" title={proc.cmdline || ''}>
              {proc.cmdline || '—'}
            </span>
          </td>
        )}
        <td className={`${cellClass} text-right`}>
          <div className="flex items-center justify-end gap-1">
            {!sys && (
              <button
                onClick={() => suspended ? onResume(proc) : onSuspend(proc)}
                className="inline-flex items-center gap-1 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-2 py-1.5 text-xs font-semibold text-yellow-400 transition-colors hover:border-yellow-500/50 hover:bg-yellow-500/20 hover:text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                aria-label={suspended ? `Resume process ${proc.name} (PID ${proc.pid})` : `Suspend process ${proc.name} (PID ${proc.pid})`}
              >
                {suspended ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              </button>
            )}
            <button
              onClick={() => onKill(proc)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:border-red-500/60 hover:bg-red-500/20 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/50"
              aria-label={`Kill process ${proc.name} (PID ${proc.pid})`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  const renderGroupRow = (name: string, procs: ProcessInfo[]) => {
    const expanded = expandedGroups.has(name)
    const allPorts = Array.from(new Set(procs.flatMap(p => p.ports)))
    const totalPids = procs.length
    const groupSelected = procs.every(p => selectedPids.has(p.pid))
    const halfSelected = procs.some(p => selectedPids.has(p.pid)) && !groupSelected
    return (
      <tr
        key={`group-${name}`}
        className="border-b border-gray-700/50 bg-gray-800/30 transition-colors hover:bg-gray-700/40"
      >
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={groupSelected}
            ref={(el) => { if (el) el.indeterminate = halfSelected }}
            onChange={() => {
              if (groupSelected) procs.forEach(p => onToggleSelect(p.pid))
              else procs.forEach(p => { if (!selectedPids.has(p.pid)) onToggleSelect(p.pid) })
            }}
            className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500/30"
          />
        </td>
        <td className={cellClass}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-gray-400">
              {Array.from(new Set(procs.map(p => p.pid))).slice(0, 3).map(pid => (
                <span key={pid} className="font-mono text-xs">{pid}</span>
              ))}
              {totalPids > 3 && <span className="text-xs">…</span>}
            </div>
          </div>
        </td>
        <td className={cellClass}>
          <span className="flex items-center gap-2">
            <button
              onClick={() => toggleGroup(name)}
              className="flex items-center gap-1 text-white hover:text-emerald-400 transition-colors"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="text-sm font-medium">{name}</span>
            </button>
            <span className="rounded bg-gray-700/60 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
              ×{totalPids}
            </span>
          </span>
        </td>
        <td className={`${cellClass} font-mono text-gray-300`}>
          {allPorts.length > 0 ? allPorts.join(', ') : '—'}
        </td>
        <td className={`${cellClass} text-gray-400`}>{procs[0]?.protocol || 'TCP'}</td>
        {showCmdline && <td className={`${cellClass} text-gray-500 italic`}>Multiple</td>}
        <td className={`${cellClass} text-right`}>
          <button
            onClick={() => {
              procs.forEach(p => {
                if (!selectedPids.has(p.pid)) onToggleSelect(p.pid)
              })
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:border-red-500/60 hover:bg-red-500/20 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Kill All
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800/50">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700 bg-gray-800">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500/30"
              />
            </th>
            <th className={headerClass} onClick={() => handleSort('pid')}>
              PID <SortIcon column="pid" />
            </th>
            <th className={headerClass} onClick={() => handleSort('name')}>
              Name <SortIcon column="name" />
            </th>
            <th className={headerClass} onClick={() => handleSort('ports')}>
              Port(s) <SortIcon column="ports" />
            </th>
            <th className={headerClass} onClick={() => handleSort('protocol')}>
              Protocol <SortIcon column="protocol" />
            </th>
            {showCmdline && (
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                Command Line
              </th>
            )}
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {groups ? (
            groups.flatMap(([name, procs]) => {
              const rows = [renderGroupRow(name, procs)]
              if (expandedGroups.has(name)) {
                rows.push(...procs.map(p => renderProcessRow(p, true)))
              }
              return rows
            })
          ) : (
            sorted.map(p => renderProcessRow(p))
          )}
        </tbody>
      </table>
    </div>
  )
}
