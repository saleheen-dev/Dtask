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
  killProcess: (pid: number) => Promise<void>
  error: string | null
}

export function useProcesses({ autoRefresh, intervalMs = 3000 }: UseProcessesOptions): UseProcessesReturn {
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.listProcesses()
      setProcesses(result)
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
        return
      }
      await refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to kill process ${pid}`
      setError(message)
    }
  }, [refresh])

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

  return { processes, loading, refresh, killProcess, error }
}