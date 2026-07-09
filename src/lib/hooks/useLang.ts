"use client";

import { useState, useEffect } from "react";

export type Lang = "tr" | "en";

const STORAGE_KEY = "netasoft-lang";

export function useLang() {
  const [lang, setLangState] = useState<Lang>("tr");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = (localStorage.getItem(STORAGE_KEY) as Lang) ?? "tr";
      setLangState(saved);
    } catch {
      setLangState("tr");
    }
    setMounted(true);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch { /* ignore */ }
  };

  if (!mounted) return { lang: "tr" as Lang, setLang: () => {} };

  return { lang, setLang };
}
