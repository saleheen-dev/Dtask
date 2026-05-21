import { contextBridge, ipcRenderer } from 'electron'
import type { ProcessInfo, KillResult } from '../common/types'

contextBridge.exposeInMainWorld('electronAPI', {
  listProcesses: (): Promise<ProcessInfo[]> => ipcRenderer.invoke('process:list'),
  killProcess: (pid: number): Promise<KillResult> => ipcRenderer.invoke('process:kill', pid),
  onRefreshProcessList: (callback: () => void) => {
    ipcRenderer.on('refresh:process-list', callback)
    return () => {
      ipcRenderer.removeListener('refresh:process-list', callback)
    }
  }
})
