import type { ProcessInfo, KillResult } from '../common/types'

declare global {
  interface Window {
    electronAPI: {
      listProcesses: () => Promise<ProcessInfo[]>;
      killProcess: (pid: number) => Promise<KillResult>;
      onRefreshProcessList: (callback: () => void) => () => void;
    }
  }
}

export {};
