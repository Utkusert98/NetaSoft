"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Send, Sparkles, Globe, Volume2, VolumeX } from "lucide-react";
import { useLangContext } from "@/app/providers/LangProvider";
import type { Lang } from "@/lib/hooks/useLang";
import { useVoiceSettings } from "@/lib/hooks/useVoiceSettings";
import { NetaSoftIcon } from "@/components/ui/NetaSoftLogo";

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
  followUps?: string[];
}

const QUICK_ACTIONS: Record<Lang, string[]> = {
  tr: [
    "Bu ay kârda mıyım zararda mıyım?",
    "SGK faturalarım ne zaman gelecek?",
    "Vadesi yaklaşan senetlerim var mı?",
    "Son 12 ayda en çok ne harcadım?",
  ],
  en: [
    "Am I profitable or in loss this month?",
    "When will my SGK payments arrive?",
    "Do I have any promissory notes due soon?",
    "What was my biggest expense in the last 12 months?",
  ],
};

const FOLLOW_UP_SUGGESTIONS: Record<Lang, string[][]> = {
  tr: [
    ["SGK ödemelerimin detayını ver", "Bu ayki en büyük giderim ne?", "Geçen aya göre durumum nasıl?"],
    ["Kaç tane senetim var?", "Yaklaşan ödemelerimi göster", "Platform gelirlerimi analiz et"],
    ["Net kâr marjım nedir?", "Personel giderlerim ne kadar?", "Depoya ne kadar havale yaptım?"],
    ["Bu ay kâr ettim mi?", "SGK gelirim toplam ne kadar?", "Aylık sabit giderlerim neler?"],
  ],
  en: [
    ["Give me SGK payment details", "What was my biggest expense this month?", "How do I compare to last month?"],
    ["How many promissory notes do I have?", "Show me upcoming payments", "Analyze my platform income"],
    ["What is my net profit margin?", "What are my staff expenses?", "How much did I transfer to warehouse?"],
    ["Did I make a profit this month?", "What is my total SGK income?", "What are my monthly fixed expenses?"],
  ],
};

const UI_TEXT: Record<Lang, {
  title: string;
  subtitle: string;
  placeholder: string;
  send: string;
  welcome: string;
  thinking: string;
  suggestions: string;
  micStart: string;
  micStop: string;
  micUnsupported: string;
  speak: string;
  ttsUnsupported: string;
}> = {
  tr: {
    title: "NetAI",
    subtitle: "Eczane finansı hakkında sorularınızı sorun — tüm kayıtlarınıza göre analiz yapar. Sesli de konuşabilirsiniz.",
    placeholder: "Eczane finansı hakkında sorunuzu yazın... (Enter ile gönder)",
    send: "Gönder",
    welcome: "Merhaba! Ben NetAI, NetaSoft'un eczane asistanınım.\n\nSGK takibi, senet vadeleri, kârlılık analizi ve tüm finansal geçmişiniz hakkında sorularınızı yanıtlayabilirim.\n\nNasıl yardımcı olabilirim?",
    thinking: "NetAI analiz ediyor...",
    suggestions: "Bunları da sorabilirsiniz:",
    micStart: "Sesli komutu başlat",
    micStop: "Dinlemeyi durdur",
    micUnsupported: "Bu tarayıcı sesli komutu desteklemiyor",
    speak: "Sesli oku",
    ttsUnsupported: "Bu tarayıcı sesli okumayı desteklemiyor",
  },
  en: {
    title: "NetAI",
    subtitle: "Ask questions about your pharmacy finances — analyzes all your records. You can also talk by voice.",
    placeholder: "Type your question about pharmacy finance... (Enter to send)",
    send: "Send",
    welcome: "Hello! I'm NetAI, NetaSoft's pharmacy assistant.\n\nI can answer questions about SGK tracking, promissory note due dates, profitability analysis, and your complete financial history.\n\nHow can I assist you?",
    thinking: "NetAI is analyzing...",
    suggestions: "You can also ask:",
    micStart: "Start voice command",
    micStop: "Stop listening",
    micUnsupported: "This browser does not support voice command",
    speak: "Read aloud",
    ttsUnsupported: "This browser does not support voice playback",
  },
};

function NetAiOrb({ size = 36, active = false }: { size?: number; active?: boolean }) {
  return (
    <div className={`netai-orb ${active ? "netai-orb-active" : ""}`} style={{ width: size, height: size, flexShrink: 0 }}>
      <div className="netai-orb-ring" />
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: "linear-gradient(135deg, #163300, #4e7c3f)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 0 1px rgba(159,232,112,0.35)",
      }}>
        <NetaSoftIcon size={Math.round(size * 0.62)} variant="white" />
      </div>
    </div>
  );
}

function AssistantMessage({
  content, canSpeak, speaking, onSpeak, speakLabel,
}: {
  content: string; canSpeak: boolean; speaking: boolean; onSpeak: () => void; speakLabel: string;
}) {
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
      <NetAiOrb active={speaking} />
      <div style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "var(--radius-lg)", padding: "12px 16px", maxWidth: "80%",
        fontSize: "var(--font-size-sm)", lineHeight: 1.7, whiteSpace: "pre-wrap",
        color: "#e7e9ee",
      }}>
        {content}
        {canSpeak && (
          <div style={{ marginTop: "8px" }}>
            <button
              type="button"
              onClick={onSpeak}
              title={speakLabel}
              aria-label={speakLabel}
              style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                background: "none", border: "none", cursor: "pointer",
                color: speaking ? "#9fe870" : "rgba(231,233,238,0.55)",
                fontSize: "12px", fontWeight: 600, padding: 0,
              }}
            >
              {speaking ? <Volume2 size={14} /> : <VolumeX size={14} />} {speakLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", flexDirection: "row-reverse" }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, #163300, #4e9b3f)", color: "white",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: "14px",
      }}>
        S
      </div>
      <div style={{
        background: "linear-gradient(135deg, #234d0a, #163300)", color: "white",
        borderRadius: "var(--radius-lg)", padding: "12px 16px", maxWidth: "80%",
        fontSize: "var(--font-size-sm)", lineHeight: 1.7, whiteSpace: "pre-wrap",
      }}>
        {content}
      </div>
    </div>
  );
}

// Sohbet geçmişi sayfalar arası geçişte (route değişince bileşen unmount
// olduğu için) kaybolmasın diye localStorage'a yazılır — sunucuya
// gönderilmez, sadece bu tarayıcıda kalıcı olur.
const CHAT_STORAGE_KEY = "netasoft_ai_chat_history";

function loadStoredMessages(): Message[] | null {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as Message[];
  } catch {
    return null;
  }
}

export default function AiDestek() {
  const { lang } = useLangContext();
  const ui = UI_TEXT[lang];

  const [messages, setMessages] = useState<Message[]>([{
    id: "welcome",
    role: "assistant",
    content: ui.welcome,
  }]);
  // SSR ile ilk render arasında tutarlılık bozulmasın diye (localStorage
  // sunucuda yok) geçmiş, mount SONRASI bir effect'te yüklenir — `loaded`
  // false olduğu sürece kaydetme effect'i devreye girmez, aksi halde ilk
  // render'daki varsayılan karşılama mesajı, henüz yüklenmemiş geçmişin
  // üzerine yazıp onu sessizce siler.
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const pendingRef = useRef("");
  const isAnimatingRef = useRef(false);
  const followUpIndexRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Sesli komut (STT) ────────────────────────────────────────
  const { settings: voiceSettings } = useVoiceSettings();
  const [micSupported, setMicSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // ── Sesli okuma (TTS) ────────────────────────────────────────
  const [ttsSupported, setTtsSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Tarayıcı desteği yalnızca mount sonrası, gerçek window nesnesi üzerinden
    // tespit edilebilir (SSR'da yok) — senkron bir alternatifi yoktur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMicSupported(Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTtsSupported(typeof window.speechSynthesis !== "undefined");
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new Ctor();
    recognition.lang = lang === "tr" ? "tr-TR" : "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Otomatik gönderme YAPILMAZ — yanlış transkripsiyon riskine karşı
      // kullanıcı metni gözden geçirip kendisi gönderir.
      const transcript = event.results[event.results.length - 1][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [listening, lang]);

  const speak = useCallback((id: string, text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    // Aynı mesaj tekrar tıklanırsa okumayı durdur
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "tr" ? "tr-TR" : "en-US";
    utterance.rate = voiceSettings.rate;
    utterance.pitch = voiceSettings.pitch;
    if (voiceSettings.voiceURI) {
      const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceSettings.voiceURI);
      if (voice) utterance.voice = voice;
    }
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  }, [lang, voiceSettings, speakingId]);

  useEffect(() => {
    const stored = loadStoredMessages();
    // localStorage (harici bir sistem) mount sonrası okunuyor — SSR'da mevcut
    // olmadığı için render sırasında değil, effect içinde senkronize edilir.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setMessages(stored);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // localStorage dolu/gizli mod vb. — sohbet devam eder, sadece kalıcı olmaz
    }
  }, [messages, loaded]);

  // Update welcome message when lang changes (React'in "render sırasında state
  // sıfırlama" deseni — effect yerine, çünkü bu bir prop değişimine tepki verir).
  const [prevLang, setPrevLang] = useState(lang);
  if (lang !== prevLang) {
    setPrevLang(lang);
    setMessages([{ id: "welcome", role: "assistant", content: UI_TEXT[lang].welcome }]);
    setDisplayedText("");
  }

  // Typewriter yardımcı ref'leri, dil değiştiğinde effect içinde sıfırlanır
  // (ref güncellemeleri render sırasında değil, effect içinde yapılmalı).
  useEffect(() => {
    pendingRef.current = "";
    isAnimatingRef.current = false;
  }, [lang]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, displayedText]);

  const startTypewriter = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    const tick = () => {
      const pending = pendingRef.current;
      if (!pending) { isAnimatingRef.current = false; return; }
      // Take up to 2 chars per tick for a natural pace (~160 chars/sec at 12ms)
      const take = Math.min(2, pending.length);
      pendingRef.current = pending.slice(take);
      setDisplayedText(prev => prev + pending.slice(0, take));
      setTimeout(tick, 12);
    };
    setTimeout(tick, 12);
  }, []);

  const startNewChat = () => {
    pendingRef.current = "";
    isAnimatingRef.current = false;
    setDisplayedText("");
    setLoading(false);
    setInput("");
    setMessages([{ id: "welcome", role: "assistant", content: ui.welcome }]);
    followUpIndexRef.current = 0;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    setDisplayedText("");
    pendingRef.current = "";
    isAnimatingRef.current = false;

    try {
      const apiMessages = history
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({ messages: apiMessages, lang }),
      });

      if (!res.ok || !res.body) {
        let errMessage = lang === "tr" ? "Bir hata oluştu" : "An error occurred";
        try {
          const err = await res.json() as { error?: string };
          if (err.error) errMessage = err.error;
        } catch {
          // Sunucu/ağ katmanı JSON olmayan bir hata döndürdü (ör. zaman aşımı) — genel mesajı kullan
        }
        throw new Error(errMessage);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        pendingRef.current += chunk;
        startTypewriter();
      }

      // Wait for typewriter to drain (max 8s) then snap to full text
      await new Promise<void>(resolve => {
        const deadline = setTimeout(() => { isAnimatingRef.current = false; resolve(); }, 8000);
        const check = setInterval(() => {
          if (!isAnimatingRef.current) { clearInterval(check); clearTimeout(deadline); resolve(); }
        }, 50);
      });

      // Pick next follow-up set (deterministic rotation — Math.random() render sırasında
      // saf olmayan bir çağrı olduğu için kullanılmıyor, bkz. react-hooks/purity kuralı)
      const followUpOptions = FOLLOW_UP_SUGGESTIONS[lang];
      followUpIndexRef.current = (followUpIndexRef.current + 1) % followUpOptions.length;
      const followUpSet = followUpOptions[followUpIndexRef.current];

      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: accumulated,
        followUps: followUpSet,
      }]);
      setDisplayedText("");
      pendingRef.current = "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : (lang === "tr" ? "Bağlantı hatası" : "Connection error");
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `⚠️ ${lang === "tr" ? "Hata" : "Error"}: ${msg}`,
      }]);
      setDisplayedText("");
      pendingRef.current = "";
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  return (
    <main className="ai-destek-main netai-page">
    <div className="netai-inner">
      {/* Kenar parıltısı — boşta soluk bir "nefes alma", dinlerken/düşünürken belirgin nabız */}
      <div className={`netai-glow ${(listening || loading) ? "netai-glow-active" : ""}`} aria-hidden="true" />

      {/* Header */}
      <div className="netai-hero" style={{ marginBottom: "var(--spacing-5)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--spacing-4)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", position: "relative", zIndex: 1 }}>
          <NetAiOrb size={44} active={listening || loading} />
          <div>
            <h1 className="netai-brand-text" style={{ fontSize: "var(--font-size-3xl)", marginBottom: "4px", lineHeight: 1.1 }}>
              {ui.title}
            </h1>
            <p style={{ color: "rgba(231,233,238,0.65)", fontSize: "var(--font-size-sm)" }}>
              {ui.subtitle}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
          <button
            type="button"
            onClick={startNewChat}
            disabled={loading}
            title={lang === "tr" ? "Sohbeti temizle, baştan başla" : "Clear chat and start over"}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 12px", borderRadius: "var(--radius-lg)",
              border: "1px solid rgba(159,232,112,0.3)", background: "rgba(159,232,112,0.08)",
              color: "#e7e9ee", cursor: loading ? "not-allowed" : "pointer",
              fontSize: "13px", fontWeight: 700, transition: "border-color 0.15s",
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Sparkles size={14} /> {lang === "tr" ? "Yeni Sohbet" : "New Chat"}
          </button>

          <a
            href="/ayarlar"
            title={lang === "tr" ? "Dil ayarlarına git" : "Go to language settings"}
            style={{
              display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
              padding: "6px 12px", borderRadius: "var(--radius-lg)",
              border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.05)",
              textDecoration: "none", color: "rgba(231,233,238,0.85)",
              fontSize: "13px", fontWeight: 700, transition: "border-color 0.15s",
            }}
          >
            <Globe size={14} /> {lang.toUpperCase()}
          </a>
        </div>
      </div>

      {/* Chat area — koyu stüdyo zeminiyle uyumlu, ferah bir mesaj akışı */}
      <div style={{
        flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", display: "flex", flexDirection: "column", gap: "var(--spacing-4)",
        padding: "var(--spacing-5)", background: "rgba(255,255,255,0.015)",
        borderRadius: "var(--radius-lg)", border: "1px solid rgba(255,255,255,0.06)",
        marginBottom: "var(--spacing-4)",
      }}>
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === "assistant"
              ? (
                <AssistantMessage
                  content={msg.content}
                  canSpeak={ttsSupported && voiceSettings.enabled}
                  speaking={speakingId === msg.id}
                  onSpeak={() => speak(msg.id, msg.content)}
                  speakLabel={ui.speak}
                />
              )
              : <UserMessage content={msg.content} />}

            {/* Follow-up suggestions after assistant message */}
            {msg.role === "assistant" && msg.followUps && msg.followUps.length > 0 && !loading && (
              <div style={{ marginTop: "10px", marginLeft: "48px" }}>
                <p style={{ fontSize: "11px", color: "rgba(231,233,238,0.5)", marginBottom: "6px", fontWeight: 500 }}>
                  {ui.suggestions}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {msg.followUps.map((q) => (
                    <button
                      key={q}
                      onClick={() => void sendMessage(q)}
                      style={{
                        fontSize: "12px", padding: "5px 12px",
                        borderRadius: "var(--radius-full)",
                        border: "1px solid rgba(159,232,112,0.4)",
                        background: "transparent",
                        color: "#9fe870",
                        cursor: "pointer", fontWeight: 500,
                        transition: "background 0.15s, color 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#9fe870"; e.currentTarget.style.color = "#0b0c10"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9fe870"; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {displayedText && (
          <AssistantMessage content={displayedText + "▍"} canSpeak={false} speaking={false} onSpeak={() => {}} speakLabel={ui.speak} />
        )}

        {loading && !displayedText && (
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <NetAiOrb active />
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: "rgba(255,255,255,0.04)", borderRadius: "var(--radius-lg)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", gap: "5px" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "#9fe870", opacity: 0.6,
                    animation: `bounce 1s ${i * 0.15}s infinite`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: "12px", color: "rgba(231,233,238,0.6)", fontWeight: 500 }}>{ui.thinking}</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick actions — only on first load */}
      {messages.length <= 2 && !loading && (
        <div style={{ display: "flex", gap: "var(--spacing-2)", flexWrap: "wrap", marginBottom: "var(--spacing-3)" }}>
          {QUICK_ACTIONS[lang].map((q) => (
            <button
              key={q}
              onClick={() => void sendMessage(q)}
              style={{
                fontSize: "var(--font-size-xs)", padding: "6px 12px",
                borderRadius: "var(--radius-full)",
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(231,233,238,0.85)", cursor: "pointer", fontWeight: 500,
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(159,232,112,0.1)"; e.currentTarget.style.borderColor = "rgba(159,232,112,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input — Gemini benzeri tek "hap" (pill) kutu: metin alanı + ikon butonlar aynı zeminde */}
      <div style={{
        display: "flex", alignItems: "flex-end", gap: "6px",
        padding: "8px 8px 8px 18px", marginBottom: "var(--spacing-5)",
        borderRadius: "28px", border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.05)", transition: "border-color var(--transition-fast)",
      }}
      className="netai-input-pill"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={ui.placeholder}
          disabled={loading}
          rows={1}
          className="ai-chat-input"
          style={{
            flex: 1, resize: "none", padding: "10px 0",
            border: "none", background: "transparent", fontFamily: "var(--font-family)",
            color: "#e7e9ee",
            fontSize: "var(--font-size-sm)", lineHeight: 1.6,
            outline: "none", maxHeight: "120px",
          }}
        />
        {micSupported && (
          <button
            type="button"
            onClick={toggleListening}
            disabled={loading}
            title={listening ? ui.micStop : ui.micStart}
            aria-label={listening ? ui.micStop : ui.micStart}
            className={`netai-mic-btn ${listening ? "netai-mic-listening" : ""}`}
            style={{
              height: 40, width: 40, flexShrink: 0, borderRadius: "50%", border: "none",
              background: listening ? "linear-gradient(135deg, #163300, #4e9b3f)" : "transparent",
              color: listening ? "#9fe870" : "rgba(231,233,238,0.75)",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: loading ? 0.6 : 1, transition: "background 0.15s, color 0.15s",
            }}
          >
            <Mic size={18} />
          </button>
        )}
        <button
          onClick={() => void sendMessage(input)}
          disabled={loading || !input.trim()}
          aria-label={ui.send}
          title={ui.send}
          style={{
            height: 40, width: 40, flexShrink: 0, borderRadius: "50%", border: "none",
            background: loading || !input.trim() ? "rgba(159,232,112,0.25)" : "linear-gradient(120deg, #9fe870, #4e9b3f)",
            color: "#0b0c10",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Send size={17} />
        </button>
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
    </main>
  );
}
