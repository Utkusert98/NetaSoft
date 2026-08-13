"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, AlertTriangle } from "lucide-react";
import { NetaSoftLogoFull, NetaSoftIcon } from "@/components/ui/NetaSoftLogo";
import { useLangContext } from "@/app/providers/LangProvider";

export default function SifremiUnuttumPage() {
  const { lang } = useLangContext();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/v1/auth/sifremi-unuttum", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({ email }),
      });
      const data = await response.json() as { success: boolean; error?: string };

      if (!response.ok || !data.success) {
        setError(data.error ?? (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
        return;
      }

      // Kullanıcı var mı yok mu fark etmeksizin her zaman aynı başarı ekranı
      // gösterilir (hesap keşfini/e-posta enumeration'ını önlemek için) —
      // sunucu tarafı zaten aynı davranışı uyguluyor (bkz. API route).
      setSent(true);
    } catch {
      setError(lang === "en" ? "Server error, please try again." : "Sunucu hatası, lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-form-side" style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease", maxWidth: "420px" }}>
            <div style={{ marginBottom: "24px", display: "flex", justifyContent: "center", color: "var(--color-primary)" }}><Mail size={64} /></div>
            <h2 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "12px", color: "var(--color-success)" }}>
              {lang === "en" ? "Check Your Email" : "E-Postanızı Kontrol Edin"}
            </h2>
            <p style={{ color: "var(--color-text-muted)", lineHeight: 1.7 }}>
              {lang === "en"
                ? "If this email is registered, we've sent a password reset link. The link expires in 1 hour."
                : "Bu e-posta adresi sistemimizde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi. Bağlantı 1 saat içinde geçerliliğini yitirecektir."}
            </p>
            <Link href="/giris" className="auth-link" style={{ display: "inline-block", marginTop: "24px" }}>
              {lang === "en" ? "← Back to Login" : "← Giriş Sayfasına Dön"}
            </Link>
          </div>
        </div>
        <div className="auth-visual-side" />
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-form-side">
        <div className="auth-form-container">
          <div className="auth-logo">
            <NetaSoftLogoFull size={44} />
          </div>

          <h1 className="auth-title">
            {lang === "en" ? "Forgot Password" : "Şifremi Unuttum"}
          </h1>
          <p className="auth-subtitle">
            {lang === "en"
              ? "Enter your email address and we'll send you a link to reset your password."
              : "E-posta adresinizi girin, şifrenizi sıfırlamanız için bir bağlantı gönderelim."}
          </p>

          {error && (
            <div
              role="alert"
              style={{
                background: "var(--color-danger-bg)",
                border: "1px solid var(--color-danger-border)",
                borderRadius: "var(--radius-md)",
                padding: "var(--spacing-4)",
                marginBottom: "var(--spacing-5)",
                color: "var(--color-danger)",
                fontSize: "var(--font-size-sm)",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertTriangle size={15} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="email" className="form-label required">
                {lang === "en" ? "Email Address" : "E-Posta Adresi"}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className="form-input"
                placeholder="example@pharmacy.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full"
              style={{ marginTop: "var(--spacing-6)" }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18 }} />
                  {lang === "en" ? "Sending..." : "Gönderiliyor..."}
                </>
              ) : (
                lang === "en" ? "Send Reset Link" : "Sıfırlama Bağlantısı Gönder"
              )}
            </button>
          </form>

          <p className="auth-footer-text">
            <Link href="/giris" className="auth-link">
              {lang === "en" ? "← Back to Login" : "← Giriş Sayfasına Dön"}
            </Link>
          </p>
        </div>
      </div>

      <div className="auth-visual-side">
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", color: "white" }}>
          <div style={{ marginBottom: "40px" }}>
            <NetaSoftIcon size={96} variant="white" />
          </div>
          <h2 style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, marginBottom: "16px", lineHeight: 1.2, color: "white" }}>
            {lang === "en"
              ? <>Take Your Pharmacy<br />Digital</>
              : <>Eczanenizi Dijital<br />Dönüşüme Taşıyın</>}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.9)", fontSize: "var(--font-size-base)", maxWidth: "380px", lineHeight: 1.8 }}>
            {lang === "en"
              ? "No setup required. Start instantly from your browser."
              : "Kurulum gerektirmez. Tarayıcınızdan anında başlayın."}
          </p>
        </div>
      </div>
    </div>
  );
}
