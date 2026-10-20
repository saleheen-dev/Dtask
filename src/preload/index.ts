import { contextBridge, ipcRenderer } from 'electron'
import type { ProcessInfo, KillResult, LogEntry, ProcessLogTarget, RestartResult } from '../common/types'

contextBridge.exposeInMainWorld('electronAPI', {
  listProcesses: (): Promise<ProcessInfo[]> => ipcRenderer.invoke('process:list'),
  killProcess: (pid: number): Promise<KillResult> => ipcRenderer.invoke('process:kill', pid),
  suspendProcess: (pid: number): Promise<KillResult> => ipcRenderer.invoke('process:suspend', pid),
  resumeProcess: (pid: number): Promise<KillResult> => ipcRenderer.invoke('process:resume', pid),
  onRefreshProcessList: (callback: () => void) => {
    ipcRenderer.on('refresh:process-list', callback)
    return () => {
      ipcRenderer.removeListener('refresh:process-list', callback)
    }
  },
  onShowKillByPort: (callback: () => void) => {
    ipcRenderer.on('tray:show-kill-by-port', callback)
    return () => {
      ipcRenderer.removeListener('tray:show-kill-by-port', callback)
    }
  },
  getLogs: (): Promise<LogEntry[]> => ipcRenderer.invoke('logs:get'),
  clearLogs: (): Promise<void> => ipcRenderer.invoke('logs:clear'),
  getLogFilePath: (): Promise<string | null> => ipcRenderer.invoke('logs:file-path'),
  revealLogFile: (): Promise<string | null> => ipcRenderer.invoke('logs:reveal'),
  getProcessLogTarget: (pid: number): Promise<ProcessLogTarget> => ipcRenderer.invoke('process-logs:target', pid),
  readProcessLog: (filePath: string): Promise<string[]> => ipcRenderer.invoke('process-logs:read', filePath),
  watchProcessLog: (filePath: string): Promise<boolean> => ipcRenderer.invoke('process-logs:watch', filePath),
  unwatchProcessLog: (filePath: string): Promise<boolean> => ipcRenderer.invoke('process-logs:unwatch', filePath),
  revealProcessLog: (filePath: string): Promise<boolean> => ipcRenderer.invoke('process-logs:reveal', filePath),
  onProcessLogChunk: (callback: (payload: { path: string; lines: string[] }) => void) => {
    const handler = (_event: unknown, payload: { path: string; lines: string[] }) => callback(payload)
    ipcRenderer.on('process-logs:chunk', handler)
    return () => {
      ipcRenderer.removeListener('process-logs:chunk', handler)
    }
  },
  restartProcess: (pid: number, logFile?: string, workingDir?: string): Promise<RestartResult> => ipcRenderer.invoke('process:restart', pid, logFile, workingDir),
  onLog: (callback: (entry: LogEntry) => void) => {
    const handler = (_event: unknown, entry: LogEntry) => callback(entry)
    ipcRenderer.on('logs:entry', handler)
    return () => {
      ipcRenderer.removeListener('logs:entry', handler)
    }
  }
})
