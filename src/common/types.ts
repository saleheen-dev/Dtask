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
