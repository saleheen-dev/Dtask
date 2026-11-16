/**
 * Dev runner: starts the Electron dev server and mirrors all output to
 * `dev.log` (project root) as well as to the console.
 *
 * Why: `npm run dev` is often started from a shell that is not attached to a
 * visible terminal window, so build errors are easy to miss. The log file gives
 * you a stable place to check them (`tail -f dev.log` or open it in an editor).
 *
 * Usage:
 *   npm run dev       # electron + vite, logs to dev.log
 *   npm run dev:web   # renderer only -> open http://localhost:5173
 *
 * The raw `electron-vite dev` command is available as `npm run dev:electron`
 * and can be selected with the DTASK_DEV_SCRIPT environment variable.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LOG_FILE = path.join(ROOT, "dev.log");
const SCRIPT = process.env.DTASK_DEV_SCRIPT ?? "dev:electron";

fs.writeFileSync(LOG_FILE, "");

const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });

function log(chunk) {
  const text = chunk.toString();
  process.stdout.write(text);
  logStream.write(text);
}

const child = spawn(`npm run ${SCRIPT}`, {
  cwd: ROOT,
  shell: true,
  stdio: ["inherit", "pipe", "pipe"],
  env: { ...process.env, FORCE_COLOR: "1" },
});

child.stdout.on("data", log);
child.stderr.on("data", log);

function stopChild() {
  if (!child.pid) return;
  if (process.platform === "win32") {
    // `child.kill()` only kills the shell on Windows; take the whole tree down.
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    child.kill("SIGTERM");
  }
}

child.on("exit", (code) => {
  logStream.end();
  process.exit(code ?? 0);
});

process.on("SIGINT", stopChild);
process.on("SIGTERM", stopChild);
