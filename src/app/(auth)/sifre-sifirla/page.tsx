"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { NetaSoftLogoFull, NetaSoftIcon } from "@/components/ui/NetaSoftLogo";
import { calculatePasswordStrength } from "@/lib/validators/auth";
import { useLangContext } from "@/app/providers/LangProvider";

function SifreSifirlaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { lang } = useLangContext();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordStrength = calculatePasswordStrength(password);

  const PASSWORD_RULES = [
    { label: lang === "en" ? "At Least 12 Characters" : "En Az 12 Karakter", test: (p: string) => p.length >= 12 },
    { label: lang === "en" ? "Uppercase Letter (A-Z)" : "Büyük Harf (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
    { label: lang === "en" ? "Lowercase Letter (a-z)" : "Küçük Harf (a-z)", test: (p: string) => /[a-z]/.test(p) },
    { label: lang === "en" ? "Number (0-9)" : "Rakam (0-9)", test: (p: string) => /[0-9]/.test(p) },
    { label: lang === "en" ? "Special Character (!@#$...)" : "Özel Karakter (!@#$...)", test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(lang === "en" ? "Passwords do not match" : "Şifreler eşleşmiyor");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/v1/auth/sifre-sifirla", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await response.json() as { success: boolean; error?: string };

      if (!response.ok || !data.success) {
        setError(data.error ?? (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/giris"), 2500);
    } catch {
      setError(lang === "en" ? "Server error, please try again." : "Sunucu hatası, lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-form-side" style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ textAlign: "center", maxWidth: "420px" }}>
            <div style={{ marginBottom: "24px", display: "flex", justifyContent: "center", color: "var(--color-danger)" }}><AlertTriangle size={64} /></div>
            <h2 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "12px", color: "var(--color-danger)" }}>
              {lang === "en" ? "Invalid Link" : "Geçersiz Bağlantı"}
            </h2>
            <p style={{ color: "var(--color-text-muted)", lineHeight: 1.7 }}>
              {lang === "en"
                ? "This password reset link is missing or invalid. Please request a new one."
                : "Bu şifre sıfırlama bağlantısı eksik veya geçersiz. Lütfen yeni bir bağlantı isteyin."}
            </p>
            <Link href="/sifremi-unuttum" className="auth-link" style={{ display: "inline-block", marginTop: "24px" }}>
              {lang === "en" ? "Request New Link" : "Yeni Bağlantı İste"}
            </Link>
          </div>
        </div>
        <div className="auth-visual-side" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-form-side" style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease" }}>
            <div style={{ marginBottom: "24px", display: "flex", justifyContent: "center", color: "var(--color-success)" }}><CheckCircle2 size={64} /></div>
            <h2 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "12px", color: "var(--color-success)" }}>
              {lang === "en" ? "Password Updated!" : "Şifreniz Güncellendi!"}
            </h2>
            <p style={{ color: "var(--color-text-muted)" }}>
              {lang === "en" ? "Redirecting to login page..." : "Giriş sayfasına yönlendiriliyorsunuz..."}
            </p>
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
            {lang === "en" ? "Reset Password" : "Şifre Sıfırla"}
          </h1>
          <p className="auth-subtitle">
            {lang === "en"
              ? "Choose a new password for your account."
              : "Hesabınız için yeni bir şifre belirleyin."}
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
              <label htmlFor="password" className="form-label required">
                {lang === "en" ? "New Password" : "Yeni Şifre"}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="form-input"
                  placeholder={lang === "en" ? "At Least 12 Characters" : "En Az 12 Karakter"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  style={{ paddingRight: "48px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? (lang === "en" ? "Hide Password" : "Şifreyi Gizle") : (lang === "en" ? "Show Password" : "Şifreyi Göster")}
                  style={{
                    position: "absolute", right: "12px", top: "50%",
                    transform: "translateY(-50%)", background: "none",
                    border: "none", cursor: "pointer",
                    color: "var(--color-text-muted)", fontSize: "18px",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {password && (
                <div className="password-strength">
                  <div className="password-strength-bar">
                    <div
                      className={`password-strength-fill strength-${passwordStrength.score}`}
                      role="progressbar"
                      aria-valuenow={passwordStrength.score}
                      aria-valuemin={0}
                      aria-valuemax={5}
                      aria-label={lang === "en" ? "Password Strength" : "Şifre Gücü"}
                    />
                  </div>
                  <div className="password-strength-label" style={{ color: passwordStrength.color }}>
                    {lang === "en" ? "Password Strength:" : "Şifre Gücü:"} {passwordStrength.label}
                  </div>

                  <div style={{
                    marginTop: "var(--spacing-3)",
                    padding: "var(--spacing-3)",
                    background: "var(--color-bg)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)"
                  }}>
                    {PASSWORD_RULES.map((rule) => {
                      const ok = rule.test(password);
                      return (
                        <div key={rule.label} style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "var(--font-size-xs)",
                          color: ok ? "var(--color-success)" : "var(--color-text-muted)",
                          marginBottom: "4px",
                        }}>
                          <span style={{ fontSize: "12px" }}>{ok ? "✓" : "○"}</span>
                          {rule.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label required">
                {lang === "en" ? "Confirm Password" : "Şifre Tekrarı"}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  className="form-input"
                  placeholder={lang === "en" ? "Re-enter Your Password" : "Şifrenizi Tekrar Girin"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  style={{ paddingRight: "48px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  aria-label={showConfirm ? (lang === "en" ? "Hide Password" : "Şifreyi Gizle") : (lang === "en" ? "Show Password" : "Şifreyi Göster")}
                  style={{
                    position: "absolute", right: "12px", top: "50%",
                    transform: "translateY(-50%)", background: "none",
                    border: "none", cursor: "pointer",
                    color: "var(--color-text-muted)", fontSize: "18px",
                  }}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword && password === confirmPassword && (
                <span style={{ color: "var(--color-success)", fontSize: "var(--font-size-xs)", fontWeight: 500 }}>
                  ✓ {lang === "en" ? "Passwords Match" : "Şifreler Eşleşiyor"}
                </span>
              )}
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
                  {lang === "en" ? "Updating..." : "Güncelleniyor..."}
                </>
              ) : (
                lang === "en" ? "Update Password" : "Şifremi Güncelle"
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
        </div>
      </div>
    </div>
  );
}

export default function SifreSifirlaPage() {
  return (
    <Suspense fallback={null}>
      <SifreSifirlaForm />
    </Suspense>
  );
}
