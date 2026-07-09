"use client";

import { Suspense } from "react";
import { useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { NetaSoftLogoFull, NetaSoftIcon } from "@/components/ui/NetaSoftLogo";
import { useLangContext } from "@/app/providers/LangProvider";

function GirisForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/panel";
  const { lang } = useLangContext();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [name]: "", general: "" }));
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!formData.email) newErrors.email = lang === "en" ? "Email Address Required" : "E-Posta Adresi Gereklidir";
    if (!formData.password) newErrors.password = lang === "en" ? "Password Required" : "Şifre Gereklidir";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      const result = await signIn("credentials", {
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setErrors({
          general: lang === "en"
            ? "Invalid Email Or Password. Please Try Again."
            : "E-Posta Veya Şifre Hatalı. Lütfen Tekrar Deneyin.",
        });
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setErrors({ general: lang === "en" ? "Server Error, Please Try Again." : "Sunucu Hatası, Lütfen Tekrar Deneyin." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {errors.general && (
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
            gap: "var(--spacing-2)",
          }}
        >
          ⚠️ {errors.general}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="email" className="form-label required">
          {lang === "en" ? "Email Address" : "E-Posta Adresi"}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className={`form-input ${errors.email ? "error" : ""}`}
          placeholder="example@pharmacy.com"
          value={formData.email}
          onChange={handleChange}
          disabled={loading}
        />
        {errors.email && (
          <span className="form-error" role="alert">⚠ {errors.email}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="password" className="form-label required">
          {lang === "en" ? "Password" : "Şifre"}
        </label>
        <div style={{ position: "relative" }}>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className={`form-input ${errors.password ? "error" : ""}`}
            placeholder="••••••••••••"
            value={formData.password}
            onChange={handleChange}
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
              color: "var(--color-text-muted)", fontSize: "18px", padding: "4px",
            }}
          >
            {showPassword ? "🙈" : "👁"}
          </button>
        </div>
        {errors.password && (
          <span className="form-error" role="alert">⚠ {errors.password}</span>
        )}
      </div>

      <div style={{ textAlign: "right", marginBottom: "var(--spacing-6)", marginTop: "calc(-1 * var(--spacing-3))" }}>
        <Link href="/sifremi-unuttum" className="auth-link" style={{ fontSize: "var(--font-size-sm)" }}>
          {lang === "en" ? "Forgot Password" : "Şifremi Unuttum"}
        </Link>
      </div>

      <button
        type="submit"
        id="btn-login-submit"
        className="btn btn-primary btn-lg btn-full"
        style={{ marginTop: "var(--spacing-6)" }}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner" style={{ width: 18, height: 18 }} />
            {lang === "en" ? "Signing In..." : "Giriş Yapılıyor..."}
          </>
        ) : (
          lang === "en" ? "Sign In" : "Giriş Yap"
        )}
      </button>
    </form>
  );
}

function LangToggle() {
  const { lang, setLang } = useLangContext();
  return (
    <div style={{
      display: "inline-flex", alignItems: "center",
      background: "var(--color-bg)", border: "1px solid var(--color-border)",
      borderRadius: "999px", padding: "3px", marginBottom: "var(--spacing-5)",
    }}>
      {(["tr", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          style={{
            padding: "6px 20px", borderRadius: "999px", border: "none",
            background: lang === l ? "var(--color-primary)" : "transparent",
            color: lang === l ? "white" : "var(--color-text-muted)",
            fontWeight: 700, fontSize: "13px", cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          {l === "tr" ? "🇹🇷 TR" : "🇬🇧 EN"}
        </button>
      ))}
    </div>
  );
}

export default function GirisPage() {
  const { lang } = useLangContext();
  return (
    <div className="auth-page">
      {/* Sol taraf — Form */}
      <div className="auth-form-side">
        <div className="auth-form-container">
          <div className="auth-logo">
            <NetaSoftLogoFull size={44} />
          </div>

          <LangToggle />

          <h1 className="auth-title">
            {lang === "en" ? "Welcome Back" : "Tekrar Hoş Geldiniz"}
          </h1>
          <p className="auth-subtitle">
            {lang === "en"
              ? "Sign in to your account to continue managing your finances."
              : "Hesabınıza giriş yaparak finansal yönetiminize devam edin."}
          </p>

          <Suspense fallback={
            <div style={{ padding: "20px", textAlign: "center" }}>
              <div className="spinner" style={{ margin: "0 auto" }} />
            </div>
          }>
            <GirisForm />
          </Suspense>

          <p className="auth-footer-text">
            {lang === "en" ? "Don't have an account?" : "Hesabınız Yok Mu?"}{" "}
            <Link href="/kayit" className="auth-link">
              {lang === "en" ? "Sign Up Free" : "Ücretsiz Kayıt Olun"}
            </Link>
          </p>
        </div>
      </div>

      {/* Sağ taraf — Görsel */}
      <div className="auth-visual-side">
        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <div style={{ marginBottom: "40px" }}>
            <NetaSoftIcon size={96} variant="white" />
          </div>
          <h2 style={{ color: "white", fontSize: "var(--font-size-3xl)", fontWeight: 800, marginBottom: "16px", lineHeight: 1.2 }} className="auth-visual-title">
            {lang === "en"
              ? <>Financial Management<br />For Your Pharmacy</>
              : <>Eczanenizin Finansal<br />Yönetimi Artık Çok Kolay</>}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "var(--font-size-lg)", maxWidth: "400px", lineHeight: 1.6 }} className="auth-visual-subtitle">
            {lang === "en"
              ? "Income & Expense Tracking, Invoice Management, Stock Control And Detailed Reports All In One Platform."
              : "Gelir-Gider Takibi, Fatura Yönetimi, Stok Kontrolü Ve Detaylı Raporlar Tek Platformda."}
          </p>
          <div style={{ display: "flex", gap: "32px", justifyContent: "center", marginTop: "48px" }}>
            {(lang === "en"
              ? [
                  { label: "Active Pharmacies", value: "1,200+" },
                  { label: "Monthly Transactions", value: "50K+" },
                  { label: "Savings", value: "40%" },
                ]
              : [
                  { label: "Aktif Eczane", value: "1.200+" },
                  { label: "Aylık İşlem", value: "50K+" },
                  { label: "Tasarruf", value: "%40" },
                ]
            ).map((stat) => (
              <div key={stat.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, color: "var(--color-primary-light)" }} className="auth-visual-stat-value">
                  {stat.value}
                </div>
                <div style={{ fontSize: "var(--font-size-sm)", color: "rgba(255,255,255,0.6)", marginTop: "4px" }} className="auth-visual-stat-label">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
