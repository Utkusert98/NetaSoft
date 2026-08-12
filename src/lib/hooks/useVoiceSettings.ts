"use client";

import { useCallback, useEffect, useState } from "react";

// NetAI sesli komut tercihleri — hesap bazlı değil, cihaz bazlı bir tercih
// (tıpkı tema/dil gibi) olduğu için localStorage'da tutulur, DB'ye yazılmaz.
const STORAGE_KEY = "netasoft-netai-voice-settings";

export interface VoiceSettings {
  enabled: boolean;
  voiceURI: string | null;
  rate: number;
  pitch: number;
}

const DEFAULT_SETTINGS: VoiceSettings = {
  // Varsayılan kapalı — kullanıcı bilinçli olarak açmalı, sürpriz sesli
  // okuma olmamalı (AGENTS talimatı).
  enabled: false,
  voiceURI: null,
  rate: 1,
  pitch: 1,
};

function loadSettings(): VoiceSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_SETTINGS.enabled,
      voiceURI: typeof parsed.voiceURI === "string" ? parsed.voiceURI : DEFAULT_SETTINGS.voiceURI,
      rate: typeof parsed.rate === "number" ? parsed.rate : DEFAULT_SETTINGS.rate,
      pitch: typeof parsed.pitch === "number" ? parsed.pitch : DEFAULT_SETTINGS.pitch,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useVoiceSettings() {
  const [settings, setSettingsState] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // localStorage sadece mount sonrası okunabilir (SSR'da yok).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettingsState(loadSettings());
    setMounted(true);
  }, []);

  const setSettings = useCallback((next: Partial<VoiceSettings>) => {
    setSettingsState((prev) => {
      const merged = { ...prev, ...next };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // localStorage dolu/gizli mod — ayar sadece bu oturumda geçerli olur
      }
      return merged;
    });
  }, []);

  return { settings, setSettings, mounted };
}
