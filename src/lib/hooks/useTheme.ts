"use client";

import { useState, useEffect } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "netasoft-theme";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
  localStorage.setItem(STORAGE_KEY, theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // İlk yüklemede localStorage'dan oku
    try {
      const saved = (localStorage.getItem(STORAGE_KEY) as Theme) ?? "light";
      setThemeState(saved);
      applyTheme(saved);
    } catch (e) {
      setThemeState("light");
    }
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
