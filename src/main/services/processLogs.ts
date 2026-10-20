import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type {
  ProcessLogCandidate,
  ProcessLogFile,
  ProcessLogTarget,
} from "../../common/types";

const execFileAsync = promisify(execFile);

/** How many directories up we walk while looking for log files. */
const MAX_DEPTH = 8;
/** Max candidate log files returned. */
const MAX_FILES = 12;
/** Directories we never list log files from (but still walk through). */
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".cache",
  ".turbo",
  ".vercel",
  "dist",
  "build",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  "site-packages",
  "system32",
  "syswow64",
]);

/** System locations are never interesting for a dev server's logs. */
const SYSTEM_PREFIXES = [
  "c:\\windows",
  "c:\\program files",
  "c:\\program files (x86)",
  "c:\\programdata",
  "c:\\users",
  "c:\\$recycle.bin",
  "c:\\system volume information",
];

function isSystemPath(dir: string): boolean {
  const normalized = path.resolve(dir).toLowerCase();
  return SYSTEM_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}\\`),
  );
}

/** Project markers help us rank the most relevant log files first. */
const PROJECT_MARKERS = [
  "package.json",
  ".git",
  "pnpm-workspace.yaml",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "composer.json",
];

function isProjectRoot(dir: string): boolean {
  // A package.json inside node_modules is not a project root.
  const segments = path.resolve(dir).toLowerCase().split(path.sep);
  if (segments.includes("node_modules")) return false;
  return PROJECT_MARKERS.some((marker) => {
    try {
      return fs.existsSync(path.join(dir, marker));
    } catch {
      return false;
    }
  });
}

export interface ProcessMeta {
  ProcessId: number;
  ParentProcessId: number;
  Name: string;
  ExecutablePath: string | null;
  CommandLine: string | null;
}

/** Fetch a process plus its ancestors (one PowerShell round trip). */
export async function fetchProcessChain(pid: number): Promise<ProcessMeta[]> {
  const script = `
$cur = ${pid}
$out = @()
for ($i = 0; $i -lt 3 -and $cur; $i++) {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$cur"
  if (-not $p) { break }
  $out += $p | Select-Object ProcessId, ParentProcessId, Name, ExecutablePath, CommandLine
  $cur = $p.ParentProcessId
}
$out | ConvertTo-Json -Compress
`.trim();

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
    );
    const trimmed = stdout.trim();
    if (!trimmed) return [];
    const parsed = JSON.parse(trimmed);
    const list: ProcessMeta[] = Array.isArray(parsed) ? parsed : [parsed];
    return list.map((p) => ({
      ProcessId: Number(p.ProcessId),
      ParentProcessId: Number(p.ParentProcessId),
      Name: String(p.Name ?? ""),
      ExecutablePath: p.ExecutablePath ? String(p.ExecutablePath) : null,
      CommandLine: p.CommandLine ? String(p.CommandLine) : null,
    }));
  } catch {
    return [];
  }
}

/** Extract filesystem paths mentioned in a command line. */
function extractPaths(commandLine: string): string[] {
  const matches = commandLine.match(/[A-Za-z]:\\[^\s"'<>|]+/g);
  if (!matches) return [];
  return matches.map((p) => p.replace(/[,.);]+$/, ""));
}

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Collect directories worth scanning, from deepest to shallowest. */
function candidateDirs(chain: ProcessMeta[]): string[] {
  const dirs: string[] = [];
  const push = (dir: string | null) => {
    if (!dir) return;
    if (isSystemPath(dir)) return;
    if (!dirs.includes(dir)) dirs.push(dir);
  };

  for (const proc of chain) {
    const paths = proc.CommandLine ? extractPaths(proc.CommandLine) : [];
    for (const raw of paths) {
      let current = raw;
      // If the token is a file, start from its directory.
      try {
        if (fs.existsSync(current) && !isDir(current)) {
          current = path.dirname(current);
        }
      } catch {
        /* ignore */
      }
      let depth = 0;
      while (current && depth <= MAX_DEPTH) {
        push(current);
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
        depth += 1;
      }
    }
    if (proc.ExecutablePath) {
      const exeDir = path.dirname(proc.ExecutablePath);
      let current = exeDir;
      let depth = 0;
      while (current && depth <= 2) {
        push(current);
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
        depth += 1;
      }
    }
  }

  return dirs;
}

function listLogFiles(dir: string): ProcessLogFile[] {
  const base = path.basename(dir);
  if (SKIP_DIRS.has(base)) return [];
  if (isSystemPath(dir)) return [];
  // Never list files straight from a drive root (C:\DumpStack.log etc.)
  if (path.parse(dir).root === dir && !isProjectRoot(dir)) return [];

  const found: ProcessLogFile[] = [];
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/\.log$/i.test(entry.name)) continue;
    const full = path.join(dir, entry.name);
    try {
      const stat = fs.statSync(full);
      found.push({
        path: full,
        size: stat.size,
        modified: stat.mtimeMs,
      });
    } catch {
      /* ignore */
    }
  }
  return found;
}

/**
 * Find log files that plausibly belong to a process.
 *
 * A dev server started by an agent usually writes its output to a file such as
 * `dev.log`, `.tmp-dev-stack.log` or `logs/server.log` inside the project.
 */
/** Derive the directory a command should run in (project root preferred). */
export function deriveWorkingDir(commandLine: string): string | null {
  const tokens = extractPaths(commandLine);
  for (const token of tokens) {
    const resolved = path.resolve(token);
    let current = resolved;
    // If it points at a file, start from its directory.
    try {
      if (fs.existsSync(current) && !isDir(current)) {
        current = path.dirname(current);
      }
    } catch {
      /* ignore */
    }
    // Walk up to the closest project root (package.json / .git).
    let candidate: string | null = null;
    let depth = 0;
    while (current && depth <= 8) {
      if (!isDir(current)) {
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
        depth += 1;
        continue;
      }
      if (!candidate) candidate = current;
      if (isProjectRoot(current)) return current;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
      depth += 1;
    }
    if (candidate) return candidate;
  }
  return null;
}

/** Commands that are just shells should not be offered as restart targets. */
export function isShellCommand(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower === "cmd.exe" ||
    lower === "powershell.exe" ||
    lower === "pwsh.exe" ||
    lower === "conhost.exe"
  );
}

/** A directory is safe to re-run a command in. */
export function isRestartableDir(dir: string | null): boolean {
  if (!dir) return false;
  if (isSystemPath(dir)) return false;
  const normalized = path.resolve(dir).toLowerCase();
  if (normalized.startsWith("c:\\users\\")) return false;
  // A drive root (C:\) is never a sensible working directory.
  if (path.parse(dir).root === path.resolve(dir)) return false;
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

export async function getProcessLogTarget(
  pid: number,
): Promise<ProcessLogTarget> {
  const chain = await fetchProcessChain(pid);
  const proc = chain[0];

  if (!proc) {
    return {
      pid,
      name: `PID ${pid}`,
      commandLine: "",
      executablePath: "",
      workingDir: null,
      files: [],
      chain: [],
      error: "Process not found (it may have exited).",
    };
  }

  const dirs = candidateDirs(chain);
  const byPath = new Map<string, ProcessLogFile>();
  const projectDirs = new Set<string>();

  for (const dir of dirs) {
    for (const file of listLogFiles(dir)) {
      if (!byPath.has(file.path)) byPath.set(file.path, file);
    }
    // also check a `logs/` sub folder
    const logsDir = path.join(dir, "logs");
    if (isDir(logsDir)) {
      for (const file of listLogFiles(logsDir)) {
        if (!byPath.has(file.path)) byPath.set(file.path, file);
      }
    }
    if (isProjectRoot(dir)) projectDirs.add(dir);
    if (byPath.size >= MAX_FILES * 3) break;
  }

  const files = [...byPath.values()]
    .sort((a, b) => {
      // Project roots first, then most recently modified.
      const aProject = projectDirs.has(path.dirname(a.path)) ? 1 : 0;
      const bProject = projectDirs.has(path.dirname(b.path)) ? 1 : 0;
      if (aProject !== bProject) return bProject - aProject;
      return b.modified - a.modified;
    })
    .slice(0, MAX_FILES);

  const workingDir =
    files.length > 0
      ? path.dirname(files[0].path)
      : (dirs[0] ?? null);

  const candidates: ProcessLogCandidate[] = chain.map((p) => {
    const workingDir = deriveWorkingDir(p.CommandLine ?? "");
    return {
      pid: p.ProcessId,
      name: p.Name,
      commandLine: p.CommandLine ?? "",
      executablePath: p.ExecutablePath ?? "",
      workingDir,
      restartable: isRestartableDir(workingDir),
    };
  });

  return {
    pid,
    name: proc.Name,
    commandLine: proc.CommandLine ?? "",
    executablePath: proc.ExecutablePath ?? "",
    workingDir,
    files,
    chain: candidates,
  };
}

/** Decode a log buffer, handling UTF-16 (PowerShell redirection) and ANSI colours. */
function decodeBuffer(buffer: Buffer): string {
  let text: string;
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    text = buffer.toString("utf16le");
  } else {
    const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
    let nulls = 0;
    for (const byte of sample) if (byte === 0) nulls += 1;
    text =
      sample.length > 0 && nulls > sample.length / 4
        ? buffer.toString("utf16le")
        : buffer.toString("utf8");
  }
  // strip ANSI escape sequences
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

/** Read the tail of a log file as lines. */
export async function readLogFile(
  filePath: string,
  maxBytes = 256_000,
): Promise<string[]> {
  try {
    const stat = await fs.promises.stat(filePath);
    const length = Math.min(stat.size, maxBytes);
    const start = Math.max(0, stat.size - length);
    const handle = await fs.promises.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, start);
      const lines = decodeBuffer(buffer).split(/\r?\n/);
      if (start > 0) lines.shift(); // drop a possibly partial first line
      return lines;
    } finally {
      await handle.close();
    }
  } catch {
    return [];
  }
}

interface WatchState {
  offset: number;
  listener: fs.StatsListener;
}

const watchers = new Map<string, WatchState>();

/**
 * Tail a log file: emits newly appended lines through `onLines`.
 * Returns a stop function.
 */
export function watchLogFile(
  filePath: string,
  onLines: (lines: string[]) => void,
): () => void {
  stopWatching(filePath);

  let offset = 0;
  try {
    offset = fs.statSync(filePath).size;
  } catch {
    offset = 0;
  }

  const listener: fs.StatsListener = (curr) => {
      if (curr.size <= offset) {
        offset = Math.min(offset, curr.size);
        return;
      }
      void (async () => {
        try {
          const handle = await fs.promises.open(filePath, "r");
          const length = curr.size - offset;
          const buffer = Buffer.alloc(length);
          await handle.read(buffer, 0, length, offset);
          await handle.close();
          offset = curr.size;
          const text = decodeBuffer(buffer);
          if (text.trim()) onLines(text.split(/\r?\n/));
        } catch {
          /* ignore */
        }
      })();
    };

  fs.watchFile(filePath, { interval: 800, persistent: false }, listener);

  watchers.set(filePath, { offset, listener });
  return () => stopWatching(filePath);
}

export function stopWatching(filePath: string) {
  const state = watchers.get(filePath);
  if (state) {
    fs.unwatchFile(filePath, state.listener);
    watchers.delete(filePath);
  }
}
