export interface ProcessInfo {
  pid: number;
  name: string;
  ports: number[];
  protocol: string;
  address?: string;
}

export interface KillResult {
  success: boolean;
  error?: string;
}
