"use client";

import { useState, useRef, useEffect } from "react";
import { useLangContext } from "@/app/providers/LangProvider";
import type { Lang } from "@/lib/hooks/useLang";

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
}> = {
  tr: {
    title: "🤖 AI Eczane Asistanı",
    subtitle: "Eczane finansı hakkında sorularınızı sorun — tüm kayıtlarınıza göre analiz yapar.",
    placeholder: "Eczane finansı hakkında sorunuzu yazın... (Enter ile gönder)",
    send: "Gönder ➤",
    welcome: "Merhaba! Ben NetaSoft Eczane Asistanınım.\n\nSGK takibi, senet vadeleri, kârlılık analizi ve tüm finansal geçmişiniz hakkında sorularınızı yanıtlayabilirim.\n\nNasıl yardımcı olabilirim?",
    thinking: "Analiz ediliyor...",
    suggestions: "Bunları da sorabilirsiniz:",
  },
  en: {
    title: "🤖 AI Pharmacy Assistant",
    subtitle: "Ask questions about your pharmacy finances — analyzes all your records.",
    placeholder: "Type your question about pharmacy finance... (Enter to send)",
    send: "Send ➤",
    welcome: "Hello! I'm the NetaSoft Pharmacy Assistant.\n\nI can answer questions about SGK tracking, promissory note due dates, profitability analysis, and your complete financial history.\n\nHow can I assist you?",
    thinking: "Analyzing...",
    suggestions: "You can also ask:",
  },
};

function AssistantMessage({ content }: { content: string }) {
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, #4e7c3f, #9fe870)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "18px",
      }}>
        🤖
      </div>
      <div style={{
        background: "var(--color-surface)", border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)", padding: "12px 16px", maxWidth: "80%",
        fontSize: "var(--font-size-sm)", lineHeight: 1.7, whiteSpace: "pre-wrap",
      }}>
        {content}
      </div>
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", flexDirection: "row-reverse" }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
        background: "var(--color-primary)", color: "white",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: "14px",
      }}>
        S
      </div>
      <div style={{
        background: "var(--color-primary)", color: "white",
        borderRadius: "var(--radius-lg)", padding: "12px 16px", maxWidth: "80%",
        fontSize: "var(--font-size-sm)", lineHeight: 1.7, whiteSpace: "pre-wrap",
      }}>
        {content}
      </div>
    </div>
  );
}

export default function AiDestek() {
  const { lang } = useLangContext();
  const ui = UI_TEXT[lang];

  const [messages, setMessages] = useState<Message[]>([{
    id: "welcome",
    role: "assistant",
    content: ui.welcome,
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Update welcome message when lang changes
  useEffect(() => {
    setMessages([{ id: "welcome", role: "assistant", content: UI_TEXT[lang].welcome }]);
    setStreamingText("");
  }, [lang]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    setStreamingText("");

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
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? (lang === "tr" ? "Bir hata oluştu" : "An error occurred"));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setStreamingText(accumulated);
      }

      // Pick random follow-up set
      const followUpSet = FOLLOW_UP_SUGGESTIONS[lang][Math.floor(Math.random() * FOLLOW_UP_SUGGESTIONS[lang].length)];

      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: accumulated,
        followUps: followUpSet,
      }]);
      setStreamingText("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : (lang === "tr" ? "Bağlantı hatası" : "Connection error");
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: `⚠️ ${lang === "tr" ? "Hata" : "Error"}: ${msg}`,
      }]);
      setStreamingText("");
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
    <main className="page-content" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--header-height))", maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: "var(--spacing-5)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--spacing-4)" }}>
        <div>
          <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "4px" }}>
            {ui.title}
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
            {ui.subtitle}
          </p>
        </div>

        <a
          href="/ayarlar"
          title={lang === "tr" ? "Dil ayarlarına git" : "Go to language settings"}
          style={{
            display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
            padding: "6px 12px", borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)", background: "var(--color-surface)",
            textDecoration: "none", color: "var(--color-text-muted)",
            fontSize: "13px", fontWeight: 700, transition: "border-color 0.15s",
          }}
        >
          🌐 {lang.toUpperCase()}
        </a>
      </div>

      {/* Chat area */}
      <div style={{
        flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--spacing-4)",
        padding: "var(--spacing-5)", background: "var(--color-bg)",
        borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)",
        marginBottom: "var(--spacing-4)",
      }}>
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === "assistant"
              ? <AssistantMessage content={msg.content} />
              : <UserMessage content={msg.content} />}

            {/* Follow-up suggestions after assistant message */}
            {msg.role === "assistant" && msg.followUps && msg.followUps.length > 0 && !loading && (
              <div style={{ marginTop: "10px", marginLeft: "48px" }}>
                <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "6px", fontWeight: 500 }}>
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
                        border: "1px solid var(--color-primary)",
                        background: "transparent",
                        color: "var(--color-primary)",
                        cursor: "pointer", fontWeight: 500,
                        transition: "background 0.15s, color 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--color-primary)"; e.currentTarget.style.color = "white"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-primary)"; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {streamingText && <AssistantMessage content={streamingText + "▍"} />}

        {loading && !streamingText && (
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #4e7c3f, #9fe870)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
              🤖
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", gap: "5px" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "var(--color-primary)", opacity: 0.6,
                    animation: `bounce 1s ${i * 0.15}s infinite`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontWeight: 500 }}>{ui.thinking}</span>
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
              className="btn btn-ghost"
              style={{ fontSize: "var(--font-size-xs)", padding: "6px 12px" }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", gap: "var(--spacing-3)", alignItems: "flex-end" }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={ui.placeholder}
          disabled={loading}
          rows={2}
          style={{
            flex: 1, resize: "none", padding: "12px 16px",
            borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)",
            background: "var(--color-surface)", fontFamily: "var(--font-family)",
            fontSize: "var(--font-size-sm)", lineHeight: 1.6,
            outline: "none", transition: "border-color var(--transition-fast)",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
        />
        <button
          onClick={() => void sendMessage(input)}
          disabled={loading || !input.trim()}
          className="btn btn-primary"
          style={{ height: 48, paddingInline: "var(--spacing-5)", flexShrink: 0 }}
        >
          {loading ? "..." : ui.send}
        </button>
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </main>
  );
}
