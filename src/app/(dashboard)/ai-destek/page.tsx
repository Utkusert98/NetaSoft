"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Send, Sparkles, Volume2, VolumeX, Plus, MessageSquare, PanelLeft, Trash2, TrendingUp, Landmark, FileText, Receipt, type LucideIcon } from "lucide-react";
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

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
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

// QUICK_ACTIONS ile aynı sırada — her hazır soru için bir ikon (bkz. karşılama
// ekranındaki kart tasarımı).
const QUICK_ACTION_ICONS: LucideIcon[] = [TrendingUp, Landmark, FileText, Receipt];

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
  heroPlaceholder: string;
  send: string;
  welcome: string;
  thinking: string;
  suggestions: string;
  micStart: string;
  micStop: string;
  micUnsupported: string;
  speak: string;
  ttsUnsupported: string;
  history: string;
  historyEmpty: string;
  deleteChat: string;
  newChat: string;
}> = {
  tr: {
    title: "NetAI",
    subtitle: "Eczane finansı hakkında sorularınızı sorun — tüm kayıtlarınıza göre analiz yapar. Sesli de konuşabilirsiniz.",
    placeholder: "Eczane finansı hakkında sorunuzu yazın... (Enter ile gönder)",
    heroPlaceholder: "Bir şey sorun...",
    send: "Gönder",
    welcome: "Merhaba! Ben NetAI, NetaSoft'un eczane asistanınım.\n\nSGK takibi, senet vadeleri, kârlılık analizi ve tüm finansal geçmişiniz hakkında sorularınızı yanıtlayabilirim.\n\nNasıl yardımcı olabilirim?",
    thinking: "NetAI analiz ediyor...",
    suggestions: "Bunları da sorabilirsiniz:",
    micStart: "Sesli komutu başlat",
    micStop: "Dinlemeyi durdur",
    micUnsupported: "Bu tarayıcı sesli komutu desteklemiyor",
    speak: "Sesli oku",
    ttsUnsupported: "Bu tarayıcı sesli okumayı desteklemiyor",
    history: "Sohbetler",
    historyEmpty: "Henüz sohbet geçmişiniz yok",
    deleteChat: "Sohbeti sil",
    newChat: "Yeni Sohbet",
  },
  en: {
    title: "NetAI",
    subtitle: "Ask questions about your pharmacy finances — analyzes all your records. You can also talk by voice.",
    placeholder: "Type your question about pharmacy finance... (Enter to send)",
    heroPlaceholder: "Ask anything...",
    send: "Send",
    welcome: "Hello! I'm NetAI, NetaSoft's pharmacy assistant.\n\nI can answer questions about SGK tracking, promissory note due dates, profitability analysis, and your complete financial history.\n\nHow can I assist you?",
    thinking: "NetAI is analyzing...",
    suggestions: "You can also ask:",
    micStart: "Start voice command",
    micStop: "Stop listening",
    micUnsupported: "This browser does not support voice command",
    speak: "Read aloud",
    ttsUnsupported: "This browser does not support voice playback",
    history: "Chats",
    historyEmpty: "You don't have any chat history yet",
    deleteChat: "Delete chat",
    newChat: "New Chat",
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

// Sohbet geçmişi, ChatGPT/Gemini'deki gibi AYRI konuşmalar halinde
// localStorage'a yazılır — sunucuya gönderilmez, sadece bu tarayıcıda kalıcı
// olur. Önceki sürüm tek bir sohbeti (CHAT_STORAGE_KEY) saklıyordu; o eski
// kayıt, kullanıcı geçmişini kaybetmesin diye tek konuşmalık bir kayıt olarak
// göç ettirilir (bir daha o eski anahtara yazılmaz).
const CONVERSATIONS_STORAGE_KEY = "netasoft_ai_conversations";
const LEGACY_CHAT_STORAGE_KEY = "netasoft_ai_chat_history";

function deriveTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean;
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed as Conversation[];
    }
    const legacyRaw = localStorage.getItem(LEGACY_CHAT_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as unknown;
      if (Array.isArray(legacy) && legacy.length > 0) {
        const messages = legacy as Message[];
        const firstUser = messages.find((m) => m.role === "user");
        if (firstUser) {
          return [{ id: crypto.randomUUID(), title: deriveTitle(firstUser.content), messages, updatedAt: Date.now() }];
        }
      }
    }
  } catch {
    // bozuk/erişilemez localStorage — boş listeyle başla
  }
  return [];
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

  // ── Sohbet geçmişi (ChatGPT/Gemini tarzı konuşma listesi) ──────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const persistConversation = useCallback((msgs: Message[]) => {
    const realMsgs = msgs.filter((m) => m.id !== "welcome");
    if (realMsgs.length === 0) return;
    const firstUser = realMsgs.find((m) => m.role === "user");
    const title = firstUser ? deriveTitle(firstUser.content) : ui.newChat;
    setConversations((prev) => {
      const rest = prev.filter((c) => c.id !== activeId);
      return [{ id: activeId, title, messages: msgs, updatedAt: Date.now() }, ...rest];
    });
  }, [activeId, ui.newChat]);

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
    // localStorage (harici bir sistem) mount sonrası okunuyor — SSR'da mevcut
    // olmadığı için render sırasında değil, effect içinde senkronize edilir.
    // crypto.randomUUID() de aynı sebeple burada çağrılır — render sırasında
    // çağrılsaydı sunucu/istemci arasında farklı ID üretip hydration
    // uyuşmazlığına yol açardı.
    //
    // Sayfaya her girişte EN SON sohbeti otomatik açmak yerine (kullanıcı
    // geri bildirimi: "NetAI'den çıktıktan sonra tekrar girince karşılama
    // ekranı gelsin, geçmişi zaten solda görüyoruz, istersem seçerim") boş
    // karşılama ekranıyla başlanır — geçmiş listesi yine de doldurulur,
    // sadece otomatik AÇILMAZ.
    const convs = loadConversations();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations(convs);
    setActiveId(crypto.randomUUID());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      // localStorage dolu/gizli mod vb. — sohbet devam eder, sadece kalıcı olmaz
    }
  }, [conversations, loaded]);

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
    setActiveId(crypto.randomUUID());
    followUpIndexRef.current = 0;
    setHistoryOpen(false);
  };

  const selectConversation = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv || id === activeId) { setHistoryOpen(false); return; }
    pendingRef.current = "";
    isAnimatingRef.current = false;
    setDisplayedText("");
    setLoading(false);
    setInput("");
    setMessages(conv.messages);
    setActiveId(id);
    followUpIndexRef.current = 0;
    setHistoryOpen(false);
  };

  const deleteConversation = (id: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === activeId) startNewChat();
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    persistConversation(history);
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

      const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: accumulated, followUps: followUpSet };
      const finalMessages = [...history, assistantMsg];
      setMessages(finalMessages);
      persistConversation(finalMessages);
      setDisplayedText("");
      pendingRef.current = "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : (lang === "tr" ? "Bağlantı hatası" : "Connection error");
      const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: `⚠️ ${lang === "tr" ? "Hata" : "Error"}: ${msg}` };
      const finalMessages = [...history, assistantMsg];
      setMessages(finalMessages);
      persistConversation(finalMessages);
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

  // Sohbet henüz başlamadıysa (sadece karşılama mesajı var) ortalanmış,
  // Gemini/ChatGPT tarzı bir "boş ekran" gösterilir; ilk mesaj gönderilir
  // gönderilmez normal, üstten hizalı sohbet akışına geçilir.
  const isEmpty = messages.length <= 1;

  const inputPill = (hero: boolean) => (
    <div className={`netai-input-pill ${hero ? "netai-input-pill-hero" : ""}`}>
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={hero ? ui.heroPlaceholder : ui.placeholder}
        disabled={loading}
        rows={1}
        className="ai-chat-input"
      />
      {micSupported && (
        <button
          type="button"
          onClick={toggleListening}
          disabled={loading}
          title={listening ? ui.micStop : ui.micStart}
          aria-label={listening ? ui.micStop : ui.micStart}
          className={`netai-mic-btn ${listening ? "netai-mic-listening" : ""}`}
        >
          <Mic size={18} />
        </button>
      )}
      <button
        onClick={() => void sendMessage(input)}
        disabled={loading || !input.trim()}
        aria-label={ui.send}
        title={ui.send}
        className="netai-send-btn"
      >
        <Send size={17} />
      </button>
    </div>
  );

  return (
    <main className="ai-destek-main netai-page">
      {/* Kenar parıltısı — boşta soluk bir "nefes alma", dinlerken/düşünürken belirgin nabız.
          Not: yoğunluğu bilinçli olarak düşük tutulur (bkz. globals.css netai-pulse) —
          önceki sürüm mesaj gönderirken ekranı neredeyse tamamen kaplayan aşırı parlak
          bir ışıkla kaplıyordu (gerçek kullanıcı geri bildirimi). */}
      <div className={`netai-glow ${(listening || loading) ? "netai-glow-active" : ""}`} aria-hidden="true" />

      {/* Sohbet geçmişi arkaplanı — sadece mobilde, panel açıkken tıklanınca kapatır */}
      <div className={`netai-history-backdrop ${historyOpen ? "open" : ""}`} onClick={() => setHistoryOpen(false)} aria-hidden="true" />

      {/* Sohbet geçmişi paneli — masaüstünde kalıcı sol kolon, mobilde kaydırmalı çekmece.
          ChatGPT/Gemini'deki gibi önceki konuşmalara geri dönülebilir; öncesinde sayfa
          tek bir sohbeti hatırlıyordu, geçmiş konuşmalara ulaşmanın hiçbir yolu yoktu. */}
      <aside className={`netai-history-panel ${historyOpen ? "open" : ""}`} aria-label={ui.history}>
        <button type="button" className="netai-new-chat-btn" onClick={startNewChat}>
          <Plus size={16} /> {ui.newChat}
        </button>
        <div className="netai-history-list">
          {conversations.length === 0 ? (
            <p className="netai-history-empty">{ui.historyEmpty}</p>
          ) : conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`netai-history-item ${c.id === activeId ? "active" : ""}`}
              onClick={() => selectConversation(c.id)}
            >
              <MessageSquare size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
              <span className="netai-history-item-title">{c.title}</span>
              <span
                role="button"
                tabIndex={0}
                className="netai-history-delete"
                onClick={(e) => deleteConversation(c.id, e)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); deleteConversation(c.id, e); } }}
                aria-label={ui.deleteChat}
                title={ui.deleteChat}
              >
                <Trash2 size={13} />
              </span>
            </button>
          ))}
        </div>
      </aside>

    <div className="netai-chat-col">
    <div className="netai-chat-inner">
      {/* Üst çubuk — dar ve kompakt (mobilde ekranın çeyreğini kaplayan eski geniş
          başlık+alt yazı+iki buton satırı yerine); dil artık Ayarlar'daki genel dil
          tercihinden geliyor, burada ayrı bir TR/EN düğmesine gerek yok. */}
      <div className="netai-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <button
            type="button"
            className="netai-history-toggle"
            onClick={() => setHistoryOpen(true)}
            aria-label={ui.history}
            title={ui.history}
          >
            <PanelLeft size={19} />
          </button>
          <NetAiOrb size={32} active={listening || loading} />
          <h1 className="netai-brand-text" style={{ fontSize: "var(--font-size-xl)", lineHeight: 1.1 }}>
            {ui.title}
          </h1>
        </div>
        <button
          type="button"
          className="netai-topbar-newchat"
          onClick={startNewChat}
          disabled={loading}
          title={lang === "tr" ? "Sohbeti temizle, baştan başla" : "Clear chat and start over"}
          aria-label={ui.newChat}
        >
          <Plus size={18} />
        </button>
      </div>
      {isEmpty ? (
        /* Karşılama ekranı — kullanıcının attığı referans görsele göre:
           dikey ortalanmış büyük başlık + giriş kutusu + hazır soru
           kartları. Backend/çalışma mantığı DEĞİŞMEDİ — sadece sunum. */
        <div className="netai-hero-empty">
          <NetAiOrb size={52} active={listening || loading} />
          <h2 className="netai-brand-text netai-hero-title">{ui.title}</h2>
          <p className="netai-hero-subtitle">{ui.subtitle}</p>
          {inputPill(true)}
          <div className="netai-quick-cards">
            {QUICK_ACTIONS[lang].map((q, i) => {
              const Icon = QUICK_ACTION_ICONS[i] ?? Sparkles;
              return (
                <button key={q} type="button" className="netai-quick-card" onClick={() => void sendMessage(q)}>
                  <span className="netai-quick-card-icon"><Icon size={16} /></span>
                  <span>{q}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Chat area — kullanıcı geri bildirimi: mesajların arkasında ayrı bir
              "kutu/pencere" görünmesin istendi (karşılama ekranında yok, sohbette de
              olmamalı) — çerçeve/arkaplan kaldırıldı, mesajlar doğrudan sayfanın
              koyu zemininde akıyor. */}
          <div style={{
            flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", display: "flex", flexDirection: "column", gap: "var(--spacing-4)",
            padding: "var(--spacing-4) 0",
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
                    <div className="netai-chip-row">
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

          {inputPill(false)}
        </>
      )}

      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
    </div>
    </main>
  );
}
