import { useEffect, useRef, useState } from "react";

/** pid -> data URL of the process application icon. */
export type ProcessIconMap = Map<number, string>;

/**
 * Lazily loads application icons for the given PIDs.
 *
 * The main process extracts the embedded icon of each executable and returns
 * it as a data URL. Results are cached per PID so re-renders never refetch.
 */
const cache = new Map<number, string>();
let inFlight: number[] = [];

export function useProcessIcons(pids: number[]): ProcessIconMap {
  const [icons, setIcons] = useState<ProcessIconMap>(
    () => new Map(cache),
  );
  const key = pids.join(",");
  const requestRef = useRef(key);

  useEffect(() => {
    const wanted = pids.filter((pid) => !cache.has(pid));
    if (wanted.length === 0) {
      if (icons.size !== cache.size) setIcons(new Map(cache));
      return;
    }

    // Skip PIDs that are already being fetched.
    const missing = wanted.filter((pid) => !inFlight.includes(pid));
    if (missing.length === 0) return;

    inFlight = [...new Set([...inFlight, ...missing])];
    requestRef.current = key;

    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const result = await window.electronAPI.getProcessIcons(missing);
        if (!alive) return;
        for (const [pid, exe] of Object.entries(result.pids)) {
          const dataUrl = result.icons[exe];
          if (dataUrl) cache.set(Number(pid), dataUrl);
        }
        setIcons(new Map(cache));
      } catch {
        /* ignore - the UI falls back to initials */
      } finally {
        inFlight = inFlight.filter((pid) => !missing.includes(pid));
      }
    }, 250);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return icons;
}
