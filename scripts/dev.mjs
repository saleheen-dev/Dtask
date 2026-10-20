/**
 * Dev runner: starts the Electron dev server and mirrors all output to
 * `dev.log` (project root) as well as to the console.
 *
 * Why: when an agent starts the dev server in a headless shell, the terminal
 * window never appears on the desktop. This wrapper gives you:
 *   - a log file you can tail (`tail -f dev.log`) or open in VS Code
 *   - a stable place to check for build errors
 *
 * Usage:
 *   npm run dev          # electron + vite, logs to dev.log
 *   npm run dev:web      # renderer only -> open http://localhost:5173
 *   npm run dev:visible  # same as dev, but in a visible Windows Terminal
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LOG_FILE = path.join(ROOT, "dev.log");
const SCRIPT = process.env.DTASK_DEV_SCRIPT ?? "dev:electron";

fs.writeFileSync(LOG_FILE, "");

const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });

function log(chunk, isError = false) {
  const text = chunk.toString();
  process.stdout.write(text);
  if (isError) process.stderr.write("");
  logStream.write(text);
}

const child = spawn(`npm run ${SCRIPT}`, {
  cwd: ROOT,
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, FORCE_COLOR: "1" },
});

child.stdout.on("data", (c) => log(c));
child.stderr.on("data", (c) => log(c));

child.on("exit", (code) => {
  logStream.end();
  process.exit(code ?? 0);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
