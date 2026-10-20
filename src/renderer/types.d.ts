/// <reference types="vite/client" />

declare module "*.png" {
  const src: string
  export default src
}

declare module "*.jpg" {
  const src: string
  export default src
}

declare module "*.svg" {
  const src: string
  export default src
}

import type { ProcessInfo, KillResult, LogEntry } from '../common/types'

declare global {
  interface Window {
    electronAPI: {
      listProcesses: () => Promise<ProcessInfo[]>;
      killProcess: (pid: number) => Promise<KillResult>;
      suspendProcess: (pid: number) => Promise<KillResult>;
      resumeProcess: (pid: number) => Promise<KillResult>;
      onRefreshProcessList: (callback: () => void) => () => void;
      onShowKillByPort: (callback: () => void) => () => void;
      getLogs: () => Promise<LogEntry[]>;
      clearLogs: () => Promise<void>;
      getLogFilePath: () => Promise<string | null>;
      revealLogFile: () => Promise<string | null>;
      onLog: (callback: (entry: LogEntry) => void) => () => void;
    }
  }
}

export {};
