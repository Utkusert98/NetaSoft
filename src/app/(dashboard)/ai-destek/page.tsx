"use client";

import { useState, useRef, useEffect } from "react";
import { useLangContext } from "@/app/providers/LangProvider";
import type { Lang } from "@/lib/hooks/useLang";

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
}

const QUICK_ACTIONS: Record<Lang, string[]> = {
  tr: [
    "Bu ay kârlılık durumum nasıl?",
    "SGK faturalarımı nasıl takip etmeliyim?",
    "Senet yönetiminde dikkat etmem gerekenler neler?",
    "Platform gelirlerimi nasıl analiz ederim?",
  ],
  en: [
    "How is my profitability this month?",
    "How should I track my SGK invoices?",
    "What should I pay attention to in promissory note management?",
    "How do I analyze my platform income?",
  ],
};

const UI_TEXT: Record<Lang, {
  title: string;
  subtitle: string;
  placeholder: string;
  send: string;
  welcome: string;
}> = {
  tr: {
    title: "🤖 AI Eczane Asistanı",
    subtitle: "Eczane yönetimi ve finansı konularında sorularınızı yanıtlar.",
    placeholder: "Eczane finansı veya yönetimi hakkında sorunuzu yazın... (Enter ile gönder)",
    send: "Gönder ➤",
    welcome: "Merhaba! Ben NetaSoft Eczane Asistanınım. Eczane finansı, SGK yönetimi, kârlılık analizi ve stok konularında size yardımcı olabilirim.\n\nNasıl yardımcı olabilirim?",
  },
  en: {
    title: "🤖 AI Pharmacy Assistant",
    subtitle: "Answers your questions about pharmacy management and finance.",
    placeholder: "Type your question about pharmacy finance or management... (Enter to send)",
    send: "Send ➤",
    welcome: "Hello! I'm the NetaSoft Pharmacy Assistant. I can help you with pharmacy finance, SGK management, profitability analysis, and inventory topics.\n\nHow can I assist you?",
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

  // Dil değişince karşılama mesajını güncelle
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
        headers: { "Content-Type": "application/json" },
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

      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: accumulated,
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

        {/* Aktif dil göstergesi */}
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
        {messages.map((msg) =>
          msg.role === "assistant"
            ? <AssistantMessage key={msg.id} content={msg.content} />
            : <UserMessage key={msg.id} content={msg.content} />
        )}

        {streamingText && <AssistantMessage content={streamingText + "▍"} />}

        {loading && !streamingText && (
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #4e7c3f, #9fe870)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
              🤖
            </div>
            <div style={{ display: "flex", gap: "5px", padding: "12px 16px", background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "var(--color-primary)", opacity: 0.6,
                  animation: `bounce 1s ${i * 0.15}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
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
