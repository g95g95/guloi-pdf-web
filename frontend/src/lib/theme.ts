import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "guloi-theme";

function getStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Current theme actually applied to <html> (set pre-paint by index.html). */
function current(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

function apply(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // Follow OS changes only while the user has expressed no explicit choice.
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (getStored() === null) {
      apply(systemTheme());
      listeners.forEach((l) => l());
    }
  };
  mql.addEventListener("change", onSystem);
  return () => {
    listeners.delete(cb);
    mql.removeEventListener("change", onSystem);
  };
}

function emit(): void {
  listeners.forEach((l) => l());
}

/**
 * Theme hook. Reads the value applied pre-paint, lets the user toggle it,
 * persists the explicit choice, and tracks OS changes until then.
 */
export function useTheme(): { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* storage unavailable — apply for this session only */
    }
    apply(t);
    emit();
  }, []);

  const toggle = useCallback(() => {
    setTheme(current() === "dark" ? "light" : "dark");
  }, [setTheme]);

  // Keep the store in sync if another tab changed the preference.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        apply(getStored() ?? systemTheme());
        emit();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { theme, toggle, setTheme };
}
