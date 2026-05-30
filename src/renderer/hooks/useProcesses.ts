import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProcessInfo } from '../../common/types'

interface UseProcessesOptions {
  autoRefresh: boolean
  intervalMs?: number
}

interface UseProcessesReturn {
  processes: ProcessInfo[]
  loading: boolean
  refresh: () => Promise<void>
  killProcess: (pid: number) => Promise<boolean>
  killMultiple: (pids: number[]) => Promise<boolean>
  suspendProcess: (pid: number) => Promise<boolean>
  resumeProcess: (pid: number) => Promise<boolean>
  error: string | null
  highlights: ReadonlyMap<number, 'added'>
}

export function useProcesses({ autoRefresh, intervalMs = 3000 }: UseProcessesOptions): UseProcessesReturn {
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<Map<number, 'added'>>(new Map())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevRef = useRef<ProcessInfo[]>([])
  const firstLoadRef = useRef(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.listProcesses()
      setProcesses(result)

      if (!firstLoadRef.current) {
        const prevPids = new Set(prevRef.current.map(p => p.pid))
        const h = new Map<number, 'added'>()
        for (const p of result) {
          if (!prevPids.has(p.pid)) h.set(p.pid, 'added')
        }
        if (h.size > 0) {
          setHighlights(h)
          setTimeout(() => setHighlights(new Map()), 2500)
        }
      } else {
        firstLoadRef.current = false
      }
      prevRef.current = result
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch processes'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const killProcess = useCallback(async (pid: number) => {
    try {
      const result = await window.electronAPI.killProcess(pid)
      if (!result.success) {
        setError(result.error ?? `Failed to kill process ${pid}`)
        return false
      }
      await refresh()
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to kill process ${pid}`
      setError(message)
      return false
    }
  }, [refresh])

  const killMultiple = useCallback(async (pids: number[]) => {
    let ok = true
    for (const pid of pids) {
      try {
        const result = await window.electronAPI.killProcess(pid)
        if (!result.success) {
          setError(result.error ?? `Failed to kill process ${pid}`)
          ok = false
          break
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : `Failed to kill process ${pid}`
        setError(message)
        ok = false
        break
      }
    }
    if (ok) await refresh()
    return ok
  }, [refresh])

  const suspendProcess = useCallback(async (pid: number) => {
    try {
      const result = await window.electronAPI.suspendProcess(pid)
      if (!result.success) {
        setError(result.error ?? `Failed to suspend process ${pid}`)
        return false
      }
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to suspend process ${pid}`
      setError(message)
      return false
    }
  }, [])

  const resumeProcess = useCallback(async (pid: number) => {
    try {
      const result = await window.electronAPI.resumeProcess(pid)
      if (!result.success) {
        setError(result.error ?? `Failed to resume process ${pid}`)
        return false
      }
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to resume process ${pid}`
      setError(message)
      return false
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const unsubscribe = window.electronAPI.onRefreshProcessList(() => {
      refresh()
    })
    return unsubscribe
  }, [refresh])

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        refresh()
      }, intervalMs)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [autoRefresh, intervalMs, refresh])

  return { processes, loading, refresh, killProcess, killMultiple, suspendProcess, resumeProcess, error, highlights }
}
