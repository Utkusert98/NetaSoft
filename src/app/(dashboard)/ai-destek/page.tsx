"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic, Send, Sparkles, Volume2, VolumeX, Plus, MessageSquare, PanelLeft, Trash2,
  TrendingUp, Landmark, FileText, Receipt, Copy, Check, RefreshCw, Square, Pencil,
  type LucideIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
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
  titleManual?: boolean;
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
  renameChat: string;
  newChat: string;
  stop: string;
  copy: string;
  copied: string;
  regenerate: string;
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
    renameChat: "Sohbeti yeniden adlandır",
    newChat: "Yeni Sohbet",
    stop: "Durdur",
    copy: "Kopyala",
    copied: "Kopyalandı",
    regenerate: "Yeniden üret",
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
    renameChat: "Rename chat",
    newChat: "New Chat",
    stop: "Stop",
    copy: "Copy",
    copied: "Copied",
    regenerate: "Regenerate",
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

function CopyButton({ content, label, copiedLabel }: { content: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Panoya erişim engellenmiş olabilir (izin/HTTPS dışı ortam) — sessizce yoksay
    }
  };
  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      title={copied ? copiedLabel : label}
      aria-label={copied ? copiedLabel : label}
      className="netai-msg-action-btn"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? copiedLabel : label}
    </button>
  );
}

function AssistantMessage({
  content, canSpeak, speaking, onSpeak, speakLabel, copyLabel, copiedLabel,
  onRegenerate, regenerateLabel, streaming,
}: {
  content: string; canSpeak: boolean; speaking: boolean; onSpeak: () => void; speakLabel: string;
  copyLabel: string; copiedLabel: string;
  onRegenerate?: () => void; regenerateLabel: string; streaming?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
      <NetAiOrb active={speaking} />
      <div style={{
        flex: 1, minWidth: 0, paddingTop: "6px",
        fontSize: "var(--font-size-sm)", lineHeight: 1.7,
        color: "#e7e9ee",
      }}>
        <div className="netai-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{content}</ReactMarkdown>
        </div>
        {!streaming && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
            <CopyButton content={content} label={copyLabel} copiedLabel={copiedLabel} />
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                title={regenerateLabel}
                aria-label={regenerateLabel}
                className="netai-msg-action-btn"
              >
                <RefreshCw size={13} /> {regenerateLabel}
              </button>
            )}
            {canSpeak && (
              <button
                type="button"
                onClick={onSpeak}
                title={speakLabel}
                aria-label={speakLabel}
                className="netai-msg-action-btn"
                style={{ color: speaking ? "#9fe870" : undefined }}
              >
                {speaking ? <Volume2 size={13} /> : <VolumeX size={13} />} {speakLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div style={{
        background: "rgba(255,255,255,0.07)", color: "#fff",
        borderRadius: "var(--radius-lg)", padding: "10px 16px", maxWidth: "80%",
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
  const accumulatedRef = useRef("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const followUpIndexRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Sohbet geçmişi (ChatGPT/Gemini tarzı konuşma listesi) ──────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const persistConversation = useCallback((msgs: Message[]) => {
    const realMsgs = msgs.filter((m) => m.id !== "welcome");
    if (realMsgs.length === 0) return;
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === activeId);
      // Kullanıcı sohbeti elle yeniden adlandırdıysa (titleManual), yeni bir
      // mesaj gönderildiğinde/yeniden üretildiğinde başlık otomatik olarak
      // ilk mesajdan tekrar türetilip ÜZERİNE YAZILMAZ.
      let title = existing?.title;
      if (!existing?.titleManual) {
        const firstUser = realMsgs.find((m) => m.role === "user");
        title = firstUser ? deriveTitle(firstUser.content) : ui.newChat;
      }
      const rest = prev.filter((c) => c.id !== activeId);
      return [{ id: activeId, title: title ?? ui.newChat, titleManual: existing?.titleManual, messages: msgs, updatedAt: Date.now() }, ...rest];
    });
  }, [activeId, ui.newChat]);

  const renameConversation = useCallback((id: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: clean, titleManual: true } : c)));
  }, []);

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

  // Sohbetin bir sonraki adımını (AI'nin yanıtını) üretir — hem yeni mesaj
  // gönderirken hem de "Yeniden üret" ile aynı mantık tekrar kullanılır.
  // `history` her zaman son elemanı bir kullanıcı mesajı olan tam listedir.
  const runAssistantTurn = async (history: Message[]) => {
    setLoading(true);
    setDisplayedText("");
    pendingRef.current = "";
    isAnimatingRef.current = false;
    accumulatedRef.current = "";
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const apiMessages = history
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({ messages: apiMessages, lang }),
        signal: controller.signal,
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulatedRef.current += chunk;
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

      const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: accumulatedRef.current, followUps: followUpSet };
      const finalMessages = [...history, assistantMsg];
      setMessages(finalMessages);
      persistConversation(finalMessages);
      setDisplayedText("");
      pendingRef.current = "";
    } catch (err) {
      if (controller.signal.aborted) {
        // Kullanıcı "Durdur" ile üretimi kestiyse, o ana kadar akmış olan
        // metin (boş da olsa) sohbete kaydedilir — sessizce kaybolmak yerine
        // kullanıcının o ana kadar okuduğu şey elde kalır VE "Yeniden üret"
        // butonunun görünebilmesi için her zaman bir asistan mesajı eklenir
        // (aksi halde henüz hiç metin akmadan durdurulduğunda geriye hiçbir
        // mesaj kalmıyor, dolayısıyla yeniden dene seçeneği hiç çıkmıyordu).
        const partial = accumulatedRef.current.trim();
        const stoppedText = lang === "tr" ? "_(Durduruldu.)_" : "_(Stopped.)_";
        const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: partial || stoppedText };
        const finalMessages = [...history, assistantMsg];
        setMessages(finalMessages);
        persistConversation(finalMessages);
        setDisplayedText("");
        pendingRef.current = "";
      } else {
        const msg = err instanceof Error ? err.message : (lang === "tr" ? "Bağlantı hatası" : "Connection error");
        const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: `⚠️ ${lang === "tr" ? "Hata" : "Error"}: ${msg}` };
        const finalMessages = [...history, assistantMsg];
        setMessages(finalMessages);
        persistConversation(finalMessages);
        setDisplayedText("");
        pendingRef.current = "";
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      inputRef.current?.focus();
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    persistConversation(history);
    setInput("");
    await runAssistantTurn(history);
  };

  // Bir asistan cevabını beğenmeyip aynı soruyu tekrar sordurmak için — o
  // cevaba kadar olan geçmiş (kendisi hariç) korunur, cevap yeniden üretilir.
  const regenerate = async (assistantId: string) => {
    if (loading) return;
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx <= 0) return;
    const truncated = messages.slice(0, idx);
    setMessages(truncated);
    persistConversation(truncated);
    await runAssistantTurn(truncated);
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
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
  // Sohbet akışında gösterilecek mesajlar — "welcome" karşılama metni
  // yalnızca boş karşılama ekranında (isEmpty true iken, netai-hero-title/
  // subtitle olarak) gösterilir; kullanıcı ilk soruyu sorduktan sonra bu
  // metin ayrıca bir sohbet balonu olarak TEKRAR görünmemeli.
  const visibleMessages = messages.filter((m) => m.id !== "welcome");

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
        onClick={loading ? handleStop : () => void sendMessage(input)}
        disabled={!loading && !input.trim()}
        aria-label={loading ? ui.stop : ui.send}
        title={loading ? ui.stop : ui.send}
        className="netai-send-btn"
      >
        {loading ? <Square size={14} /> : <Send size={17} />}
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
            renamingId === c.id ? (
              <div key={c.id} className="netai-history-item netai-history-item-editing">
                <MessageSquare size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                <input
                  autoFocus
                  className="netai-history-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => { renameConversation(c.id, renameValue); setRenamingId(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); renameConversation(c.id, renameValue); setRenamingId(null); }
                    if (e.key === "Escape") { e.preventDefault(); setRenamingId(null); }
                  }}
                />
              </div>
            ) : (
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
                  className="netai-history-rename"
                  onClick={(e) => { e.stopPropagation(); setRenamingId(c.id); setRenameValue(c.title); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setRenamingId(c.id); setRenameValue(c.title); } }}
                  aria-label={ui.renameChat}
                  title={ui.renameChat}
                >
                  <Pencil size={12} />
                </span>
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
            )
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
            {/* "welcome" karşılama mesajı yalnızca boş (henüz mesaj gönderilmemiş)
                karşılama ekranında (netai-hero-title/subtitle) gösterilir —
                kullanıcı bir soru sorduktan sonra sohbet geçmişinde ayrıca bir
                balon olarak tekrar görünmemeli (gerçek kullanıcı geri bildirimi). */}
            {visibleMessages.map((msg, i) => (
              <div key={msg.id}>
                {msg.role === "assistant"
                  ? (
                    <AssistantMessage
                      content={msg.content}
                      canSpeak={ttsSupported && voiceSettings.enabled}
                      speaking={speakingId === msg.id}
                      onSpeak={() => speak(msg.id, msg.content)}
                      speakLabel={ui.speak}
                      copyLabel={ui.copy}
                      copiedLabel={ui.copied}
                      regenerateLabel={ui.regenerate}
                      onRegenerate={!loading && i === visibleMessages.length - 1 ? () => void regenerate(msg.id) : undefined}
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
              <AssistantMessage
                content={displayedText + "▍"} canSpeak={false} speaking={false} onSpeak={() => {}} speakLabel={ui.speak}
                copyLabel={ui.copy} copiedLabel={ui.copied} regenerateLabel={ui.regenerate} streaming
              />
            )}

            {loading && !displayedText && (
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <NetAiOrb active />
                <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingTop: "6px" }}>
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
