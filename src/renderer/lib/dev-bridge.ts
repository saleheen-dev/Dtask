/**
 * Dev-only bridge: lets the renderer run in a plain browser (no Electron).
 *
 * `electron-vite dev --rendererOnly` only starts the Vite dev server, so you can
 * open http://localhost:5173 in Chrome and inspect the UI. The real preload API
 * is not available there, so we install a mock that serves sample data.
 *
 * This module is tree-shaken out of production builds (it is only imported when
 * `import.meta.env.DEV` is true).
 */
import type { ProcessInfo } from "../../common/types";

/* Local mirror of the shared type so this mock compiles stand-alone. */
type BridgeLogTarget = {
  pid: number;
  name: string;
  commandLine: string;
  executablePath: string;
  workingDir: string | null;
  files: { path: string; size: number; modified: number }[];
  chain: unknown[];
  error?: string;
};

const SAMPLE_PROCESSES: ProcessInfo[] = [
  {
    pid: 4400,
    name: "chrome.exe",
    ports: [5173, 9222],
    protocol: "TCP",
    address: "127.0.0.1",
    cmdline: '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222',
  },
  {
    pid: 3328,
    name: "node.exe",
    ports: [4400, 56343],
    protocol: "TCP",
    address: "0.0.0.0",
    cmdline: "node next/dist/server/lib/start-server.js",
  },
  {
    pid: 1204,
    name: "System",
    ports: [135, 445],
    protocol: "TCP",
    address: "0.0.0.0",
  },
  {
    pid: 8120,
    name: "Code.exe",
    ports: [],
    protocol: "—",
    cmdline: '"C:\\Program Files\\Microsoft VS Code\\Code.exe" --type=renderer',
  },
  {
    pid: 0,
    name: "System Idle Process",
    ports: Array.from({ length: 78 }, (_, i) => 54503 + i * 7).filter(
      (p) => p < 65535,
    ),
    protocol: "TCP",
    address: "0.0.0.0",
  },
  {
    pid: 9090,
    name: "python.exe",
    ports: [8000, 8001],
    protocol: "TCP",
    address: "127.0.0.1",
    cmdline: "python -m http.server 8000",
  },
];

/*
 * Neutral placeholder tiles for the browser preview. The desktop app extracts
 * the real icon of each executable at runtime; the mock must not bundle
 * third-party application artwork.
 */
function placeholderIcon(label: string, background: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="7" fill="${background}"/>` +
    `<text x="16" y="16.5" fill="#fff" font-family="system-ui, sans-serif" ` +
    `font-size="13" font-weight="600" text-anchor="middle" ` +
    `dominant-baseline="central">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const SAMPLE_ICONS: Record<string, string> = {
  "chrome.exe": placeholderIcon("C", "#3b5f8a"),
  "node.exe": placeholderIcon("N", "#3f6b4a"),
  "Code.exe": placeholderIcon("C", "#4b4b6b"),
  "explorer.exe": placeholderIcon("E", "#6b5a3f"),
};

export function installDevBridge(): boolean {
  if (!import.meta.env.DEV) return false;
  if (window.electronAPI) return false;

  const listeners = new Set<() => void>();
  const trayListeners = new Set<() => void>();

  window.electronAPI = {
    listProcesses: async () => SAMPLE_PROCESSES,
    killProcess: async (pid: number) => {
      console.info(`[dev-bridge] killProcess(${pid}) ignored in browser preview`);
      listeners.forEach((cb) => cb());
      return { success: true };
    },
    suspendProcess: async (pid: number) => {
      console.info(`[dev-bridge] suspendProcess(${pid}) ignored in browser preview`);
      return { success: true };
    },
    resumeProcess: async (pid: number) => {
      console.info(`[dev-bridge] resumeProcess(${pid}) ignored in browser preview`);
      return { success: true };
    },
    onRefreshProcessList: (callback: () => void) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    onShowKillByPort: (callback: () => void) => {
      trayListeners.add(callback);
      return () => {
        trayListeners.delete(callback);
      };
    },
    // The log viewer is only available in the desktop app - the browser
    // preview keeps the API surface complete but without any log stream.
    getLogs: async () => [],
    clearLogs: async () => {},
    getLogFilePath: async () => null,
    revealLogFile: async () => null,
    onLog: () => () => {},
    getBridgeLogTarget: async (pid: number): Promise<BridgeLogTarget> => ({
      pid,
      name: "node.exe",
      commandLine: "node next dev (browser preview - no process inspection available)",
      executablePath: "",
      workingDir: null,
      files: [],
      chain: [],
    }),
    readProcessLog: async () => [],
    watchProcessLog: async () => true,
    unwatchProcessLog: async () => true,
    revealProcessLog: async () => true,
    getProcessIcons: async (pids: number[]) => {
      const icons: Record<string, string> = {};
      const map: Record<number, string> = {};
      for (const pid of pids) {
        const proc = SAMPLE_PROCESSES.find((p) => p.pid === pid);
        const icon = proc ? SAMPLE_ICONS[proc.name] : undefined;
        if (!proc || !icon) continue;
        const key = `mock://${proc.name}`;
        icons[key] = icon;
        map[pid] = key;
      }
      return { icons, pids: map };
    },
    restartProcess: async () => ({
      success: false,
      message: "Restart is not available in browser preview mode.",
    }),
    onProcessLogChunk: (callback: (payload: { path: string; lines: string[] }) => void) => {
      return () => {};
    },
  } as unknown as Window["electronAPI"];

  console.info(
    "%c[dev-bridge] Electron API mocked - browser preview mode",
    "color:#34d399",
  );
  return true;
}
