export interface ProcessInfo {
  pid: number;
  name: string;
  ports: number[];
  protocol: string;
  address?: string;
  cmdline?: string;
}

export interface KillResult {
  success: boolean;
  error?: string;
}

export type LogLevel = "info" | "warn" | "error";
export type LogSource = "main" | "renderer" | "system";

export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  source: LogSource;
  message: string;
}

export interface ProcessLogFile {
  path: string;
  size: number;
  modified: number;
}

export interface ProcessLogCandidate {
  pid: number;
  name: string;
  commandLine: string;
  executablePath: string;
  workingDir: string | null;
  restartable: boolean;
}

export interface ProcessLogTarget {
  pid: number;
  name: string;
  commandLine: string;
  executablePath: string;
  workingDir: string | null;
  files: ProcessLogFile[];
  chain: ProcessLogCandidate[];
  error?: string;
}

export interface RestartResult {
  success: boolean;
  message: string;
  logFile?: string;
  workingDir?: string;
}
