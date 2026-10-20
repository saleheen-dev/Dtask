import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { ProcessIconResult } from "../../common/types";

const execFileAsync = promisify(execFile);

/** exePath -> data URL (png) */
const iconCache = new Map<string, string>();
/** pid -> exePath, refreshed lazily */
let pathCache = new Map<number, string>();
let pathCacheAt = 0;
const PATH_CACHE_MS = 10_000;

function isWindows(): boolean {
  return process.platform === "win32";
}

/** Resolve the executable behind each PID (Windows only). */
async function resolveExecutablePaths(
  pids: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!isWindows() || pids.length === 0) return map;

  const now = Date.now();
  if (now - pathCacheAt < PATH_CACHE_MS) {
    for (const pid of pids) {
      const exe = pathCache.get(pid);
      if (exe) map.set(pid, exe);
    }
    // every requested pid already known -> reuse
    if (map.size === new Set(pids).size) return map;
  }

  const ids = pids.join(",");
  const script = `Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -in @(${ids}) } | Select-Object ProcessId, ExecutablePath | ConvertTo-Json -Compress`;

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
    );
    const trimmed = stdout.trim();
    if (trimmed) {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of list) {
        const pid = Number(entry.ProcessId);
        const exe = entry.ExecutablePath ? String(entry.ExecutablePath) : "";
        if (Number.isFinite(pid) && exe) {
          map.set(pid, exe);
          pathCache.set(pid, exe);
        }
      }
    }
  } catch {
    // fall back to the cached values
    for (const pid of pids) {
      const exe = pathCache.get(pid);
      if (exe) map.set(pid, exe);
    }
  }

  pathCacheAt = now;
  return map;
}

/** Extract the icon embedded in an executable (one PowerShell call for all). */
async function extractIcons(exePaths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!isWindows() || exePaths.length === 0) return result;

  const missing = exePaths.filter((p) => !iconCache.has(p));
  if (missing.length === 0) {
    for (const p of exePaths) {
      const cached = iconCache.get(p);
      if (cached) result.set(p, cached);
    }
    return result;
  }

  // Write the list to a temp file so no shell quoting issues arise.
  const listFile = path.join(
    os.tmpdir(),
    `dtask-icons-${process.pid}-${Date.now()}.json`,
  );
  try {
    fs.writeFileSync(listFile, JSON.stringify(missing), "utf8");

    const script = `
$ErrorActionPreference = "SilentlyContinue"
Add-Type -AssemblyName System.Drawing
$paths = @()
if (Test-Path $env:DTASK_ICON_LIST) {
  $raw = Get-Content $env:DTASK_ICON_LIST -Raw
  if ($raw) { $paths = $raw | ConvertFrom-Json }
}
$out = @{}
foreach ($p in $paths) {
  try {
    $ico = [System.Drawing.Icon]::ExtractAssociatedIcon($p)
    if ($ico) {
      $bmp = $ico.ToBitmap()
      $ms = New-Object System.IO.MemoryStream
      $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      $out[$p] = [Convert]::ToBase64String($ms.ToArray())
      $bmp.Dispose()
      $ico.Dispose()
      $ms.Dispose()
    }
  } catch { }
}
if ($out.Count -eq 0) { "{}" } else { $out | ConvertTo-Json -Compress }
`.trim();

    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        windowsHide: true,
        maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, DTASK_ICON_LIST: listFile },
      },
    );

    const trimmed = stdout.trim();
    if (trimmed) {
      const parsed = JSON.parse(trimmed);
      for (const [exe, base64] of Object.entries(parsed as Record<string, string>)) {
        if (!base64) continue;
        const dataUrl = `data:image/png;base64,${base64}`;
        iconCache.set(exe, dataUrl);
        result.set(exe, dataUrl);
      }
    }
  } catch {
    // ignore - the UI falls back to an initials badge
  } finally {
    try {
      fs.unlinkSync(listFile);
    } catch {
      /* ignore */
    }
  }

  // include cached ones that were not re-extracted
  for (const p of exePaths) {
    if (!result.has(p)) {
      const cached = iconCache.get(p);
      if (cached) result.set(p, cached);
    }
  }

  return result;
}

/**
 * Resolve application icons for a set of PIDs.
 * Returns the data URLs keyed by executable path plus the pid -> exe mapping.
 */
export async function getProcessIcons(
  pids: number[],
): Promise<ProcessIconResult> {
  const result: ProcessIconResult = { icons: {}, pids: {} };
  if (pids.length === 0) return result;

  const exeByPid = await resolveExecutablePaths(pids);
  if (exeByPid.size === 0) return result;

  const icons = await extractIcons([...new Set(exeByPid.values())]);

  for (const [pid, exe] of exeByPid) {
    result.pids[pid] = exe;
    const dataUrl = icons.get(exe);
    if (dataUrl) result.icons[exe] = dataUrl;
  }

  return result;
}
