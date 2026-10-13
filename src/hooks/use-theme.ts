"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_COLORS, THEME_STORAGE_KEY } from "@/lib/site";

export type Theme = "dark" | "light";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const getSnapshot = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light");
const getServerSnapshot = (): Theme => "dark";

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_COLORS[theme]));
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* mode privat / storage diblokir — tema tetap berlaku untuk sesi ini */
  }
}

/** Tema aktif dibaca dari class <html> (diset skrip inline sebelum hydrate). */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback(() => applyTheme(getSnapshot() === "dark" ? "light" : "dark"), []);
  return { theme, toggle };
}
