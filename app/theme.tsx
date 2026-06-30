"use client";

import { useCallback, useEffect, useState } from "react";

export type ContestTheme = "light" | "dark" | "system";

const STORAGE_KEY = "trae-contest-theme";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(theme: ContestTheme): "light" | "dark" {
  return theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
}

function apply(theme: ContestTheme): void {
  const resolved = resolve(theme);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

function readStored(): ContestTheme {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "light" || saved === "dark" || saved === "system" ? saved : "light";
}

export function useContestTheme() {
  const [theme, setThemeState] = useState<ContestTheme>("light");

  useEffect(() => {
    const initial = readStored();
    setThemeState(initial);
    apply(initial);
  }, []);

  // While "system" is active, follow OS changes live.
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ContestTheme) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  }, []);

  return { theme, setTheme };
}
