"use client";

import { useState, useEffect } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "netasoft-theme";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
  localStorage.setItem(STORAGE_KEY, theme);
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme) ?? "light";
  } catch {
    return "light";
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // İlk yüklemede tema DOM'a uygulanır
    applyTheme(theme);
    // Hydration'ın tamamlandığını işaretlemek için gereklidir; senkron bir
    // alternatifi yoktur.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
  };

  // Hydration sorunlarını önlemek için
  if (!mounted) {
    return { theme: "light" as Theme, setTheme: () => {} };
  }

  return { theme, setTheme };
}
