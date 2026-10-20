import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { RestartResult } from "../../common/types";
import {
  deriveWorkingDir,
  fetchProcessChain,
  isRestartableDir,
  isShellCommand,
} from "./processLogs";

const execFileAsync = promisify(execFile);

/** Split a command line into tokens, honouring double quotes. */
export function splitCommand(commandLine: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < commandLine.length; i++) {
    const ch = commandLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (ch === " " || ch === "\t")) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

function quoteArg(arg: string): string {
  return /\s/.test(arg) ? `"${arg}"` : arg;
}

/** Locate the executable for a program token (handles .cmd/.bat shims). */
function resolveProgram(program: string): { file: string; isScript: boolean } {
  const isPathLike = /[\\/]/.test(program) || path.isAbsolute(program);

  if (isPathLike) {
    const lower = program.toLowerCase();
    if (lower.endsWith(".cmd") || lower.endsWith(".bat")) {
      return { file: program, isScript: true };
    }
    return { file: program, isScript: false };
  }

  const extensions = process.platform === "win32"
    ? [".exe", ".cmd", ".bat", ".com"]
    : [""];

  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of extensions) {
      const candidate = path.join(dir, program + ext);
      try {
        if (fs.statSync(candidate).isFile()) {
          return {
            file: candidate,
            isScript: ext === ".cmd" || ext === ".bat",
          };
        }
      } catch {
        /* keep looking */
      }
    }
  }

  return { file: program, isScript: false };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Kill a process tree (Windows) or the process group (unix). */
async function killTree(pid: number): Promise<void> {
  if (process.platform === "win32") {
    try {
      await execFileAsync("taskkill", ["/F", "/T", "/PID", String(pid)], {
        windowsHide: true,
      });
    } catch {
      /* process may already be gone */
    }
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* ignore */
      }
    }
  }
}

function resolveLogFile(logFile: string | undefined, workingDir: string): string {
  if (logFile) {
    try {
      if (fs.existsSync(path.dirname(logFile))) return logFile;
    } catch {
      /* ignore */
    }
  }
  return path.join(workingDir, "dev.log");
}

/**
 * Restart a dev-server style process:
 *  - kills the process tree
 *  - re-runs the same command line in the same working directory
 *  - redirects stdout/stderr to a log file so the output stays visible in Dtask
 */
export async function restartProcess(
  pid: number,
  logFile?: string,
  workingDirOverride?: string,
): Promise<RestartResult> {
  if (!Number.isFinite(pid) || pid < 1) {
    return { success: false, message: "Invalid PID" };
  }

  const chain = await fetchProcessChain(pid);
  const target = chain.find((p) => p.ProcessId === pid) ?? chain[0];

  if (!target) {
    return { success: false, message: "Process not found (it may have exited)." };
  }

  const commandLine = (target.CommandLine ?? "").trim();
  if (!commandLine) {
    return { success: false, message: "No command line available for this process." };
  }
  if (isShellCommand(target.Name)) {
    return {
      success: false,
      message: "Refusing to restart a plain shell — pick the actual server process.",
    };
  }

  const workingDir =
    (workingDirOverride && workingDirOverride.trim()) ||
    deriveWorkingDir(commandLine) ||
    (target.ExecutablePath ? path.dirname(target.ExecutablePath) : process.cwd());

  if (!isRestartableDir(workingDir)) {
    return {
      success: false,
      message: `Cannot safely determine the working directory for this command (${workingDir}). Set the working directory manually.`,
      workingDir,
    };
  }

  const outFile = resolveLogFile(logFile, workingDir);

  // Stop the old process (and its children).
  await killTree(pid);
  await sleep(600);

  // Start it again, detached, with output captured to the log file.
  try {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const outStream = fs.createWriteStream(outFile, { flags: "a" });

    const tokens = splitCommand(commandLine);
    if (tokens.length === 0) {
      outStream.end();
      return { success: false, message: "Could not parse the command line." };
    }
    const { file, isScript } = resolveProgram(tokens[0]);
    const args = tokens.slice(1);

    let child;
    if (isScript) {
      // .cmd/.bat shims must go through cmd.exe. The extra outer quotes make
      // `cmd /s /c` treat the whole thing as one command.
      const inner = [file, ...args].map(quoteArg).join(" ");
      child = spawn("cmd.exe", ["/d", "/s", "/c", `"${inner}"`], {
        cwd: workingDir,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        windowsVerbatimArguments: true,
      });
    } else {
      child = spawn(file, args, {
        cwd: workingDir,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    }

    // Pipe the output into the log file (reliable, and the app stays alive).
    child.stdout?.pipe(outStream);
    child.stderr?.pipe(outStream);
    child.unref();
    child.on("error", () => outStream.end());

    return {
      success: true,
      message: `Restarted: ${target.Name} (PID ${pid})`,
      logFile: outFile,
      workingDir,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to restart: ${
        err instanceof Error ? err.message : String(err)
      }`,
      workingDir,
    };
  }
}
