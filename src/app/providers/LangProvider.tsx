"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { type Lang } from "@/lib/hooks/useLang";

const STORAGE_KEY = "netasoft-lang";

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<LangContextValue>({ lang: "tr", setLang: () => {} });

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "tr";
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === "en" || saved === "tr") return saved;
  } catch { /* ignore */ }
  return "tr";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  };

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLangContext() {
  return useContext(LangContext);
}
