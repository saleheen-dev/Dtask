import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "dtask-theme";
const DEFAULT_THEME: Theme = "dark";

const getSystemTheme = (): ResolvedTheme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

export function applyTheme(theme: Theme): ResolvedTheme {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
  return resolved;
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage unavailable (e.g. blocked) - fall back to default
  }
  return DEFAULT_THEME;
}

/* Tiny global store so every consumer (header toggle, command menu, ...) stays in sync. */
let currentTheme: Theme = readStoredTheme();
let currentResolved: ResolvedTheme = resolveTheme(currentTheme);
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setTheme(theme: Theme) {
  currentTheme = theme;
  currentResolved = applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore persistence errors
  }
  emit();
}

/* Follow the OS preference while "system" is selected. */
if (typeof window !== "undefined") {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", () => {
    if (currentTheme === "system") {
      currentResolved = applyTheme("system");
      emit();
    }
  });
  applyTheme(currentTheme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(currentTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    currentResolved,
  );

  useEffect(() => {
    const listener = () => {
      setThemeState(currentTheme);
      setResolvedTheme(currentResolved);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const updateTheme = useCallback((next: Theme) => {
    setTheme(next);
  }, []);

  return { theme, resolvedTheme, setTheme: updateTheme };
}
