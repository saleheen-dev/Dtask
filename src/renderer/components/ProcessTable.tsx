import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { ProcessInfo } from '../../common/types'

type SortKey = 'pid' | 'name' | 'ports' | 'protocol'
type SortDir = 'asc' | 'desc'

interface ProcessTableProps {
  processes: ProcessInfo[]
  onKill: (process: ProcessInfo) => void
  selectedPids: Set<number>
  onToggleSelect: (pid: number) => void
  onToggleSelectAll: () => void
  conflictingPorts: Set<number>
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

export function ProcessTable({ processes, onKill, selectedPids, onToggleSelect, onToggleSelectAll, conflictingPorts }: ProcessTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('pid')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

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
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((proc) => {
            const sys = isSystemProcess(proc)
            const conflict = proc.ports.some(p => conflictingPorts.has(p))
            return (
              <tr
                key={proc.pid}
                className={`border-b border-gray-700/50 transition-colors last:border-b-0 hover:bg-gray-700/50 ${conflict ? 'bg-amber-500/5' : ''}`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedPids.has(proc.pid)}
                    onChange={() => onToggleSelect(proc.pid)}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500/30"
                  />
                </td>
                <td className="px-4 py-3 font-mono text-sm text-gray-300">{proc.pid}</td>
                <td className="px-4 py-3 text-sm text-white">
                  <span className="flex items-center gap-2">
                    {conflict && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                    {proc.name}
                    {sys && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                        System
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-sm text-gray-300">
                  {proc.ports.length > 0 ? proc.ports.join(', ') : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">{proc.protocol}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onKill(proc)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:border-red-500/60 hover:bg-red-500/20 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    aria-label={`Kill process ${proc.name} (PID ${proc.pid})`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Kill
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
