import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { LogEntry, LogLevel, LogSource } from "../../common/types";

/** Max entries kept in memory (ring buffer). */
const MAX_ENTRIES = 1000;
/** Rotate the log file once it grows past this size. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const entries: LogEntry[] = [];
const listeners = new Set<(entry: LogEntry) => void>();

let nextId = 1;
let logFilePath: string | null = null;
let fileSize = 0;

export function getLogFilePath(): string | null {
  if (logFilePath) return logFilePath;
  try {
    const dir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(dir, { recursive: true });
    logFilePath = path.join(dir, "dtask.log");
    fileSize = fs.existsSync(logFilePath) ? fs.statSync(logFilePath).size : 0;
  } catch {
    logFilePath = null;
  }
  return logFilePath;
}

function writeToFile(entry: LogEntry) {
  const file = getLogFilePath();
  if (!file) return;
  try {
    if (fileSize > MAX_FILE_BYTES) {
      fs.renameSync(file, `${file}.1`);
      fileSize = 0;
    }
    const time = new Date(entry.timestamp).toISOString();
    const line = `${time} [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}\n`;
    fs.appendFileSync(file, line, "utf8");
    fileSize += Buffer.byteLength(line);
  } catch {
    // never let logging break the app
  }
}

export function addLog(
  level: LogLevel,
  source: LogSource,
  message: string,
): LogEntry {
  const entry: LogEntry = {
    id: nextId++,
    timestamp: Date.now(),
    level,
    source,
    message: String(message),
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }

  for (const listener of listeners) {
    try {
      listener(entry);
    } catch {
      // ignore listener errors
    }
  }

  writeToFile(entry);
  return entry;
}

export function getLogs(): LogEntry[] {
  return [...entries];
}

export function clearLogs(): void {
  entries.length = 0;
}

export function onLog(listener: (entry: LogEntry) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      if (arg instanceof Error) return arg.stack ?? arg.message;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

/** Route the main process console into the in-app log viewer + log file. */
export function installConsoleCapture(): void {
  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  console.log = (...args: unknown[]) => {
    original.log(...args);
    addLog("info", "main", formatArgs(args));
  };
  console.info = (...args: unknown[]) => {
    original.info(...args);
    addLog("info", "main", formatArgs(args));
  };
  console.warn = (...args: unknown[]) => {
    original.warn(...args);
    addLog("warn", "main", formatArgs(args));
  };
  console.error = (...args: unknown[]) => {
    original.error(...args);
    addLog("error", "main", formatArgs(args));
  };
  console.debug = (...args: unknown[]) => {
    original.debug(...args);
    addLog("info", "main", formatArgs(args));
  };

  process.on("uncaughtException", (err: Error) => {
    addLog("error", "main", `Uncaught exception: ${err.stack ?? err.message}`);
  });
  process.on("unhandledRejection", (reason: unknown) => {
    addLog("error", "main", `Unhandled rejection: ${formatArgs([reason])}`);
  });
}
