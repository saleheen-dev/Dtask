import { contextBridge, ipcRenderer } from 'electron'
import type { ProcessInfo, KillResult } from '../common/types'

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
  }
})
