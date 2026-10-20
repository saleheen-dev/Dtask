import { contextBridge, ipcRenderer } from 'electron'
import type { ProcessInfo, KillResult, LogEntry } from '../common/types'

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
  onLog: (callback: (entry: LogEntry) => void) => {
    const handler = (_event: unknown, entry: LogEntry) => callback(entry)
    ipcRenderer.on('logs:entry', handler)
    return () => {
      ipcRenderer.removeListener('logs:entry', handler)
    }
  }
})
