"use client";

import { useState, useEffect } from "react";

export type Lang = "tr" | "en";

const STORAGE_KEY = "netasoft-lang";

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "tr";
  try {
    return (localStorage.getItem(STORAGE_KEY) as Lang) ?? "tr";
  } catch {
    return "tr";
  }
}

export function useLang() {
  const [lang, setLangState] = useState<Lang>(getInitialLang);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Hydration'ın tamamlandığını işaretlemek için gereklidir; sunucu/istemci
    // ilk render uyumsuzluğunu önlemek amacıyla senkron bir alternatifi yoktur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
