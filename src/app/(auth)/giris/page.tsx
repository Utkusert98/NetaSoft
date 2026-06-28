"use client";

import { Suspense } from "react";
import { useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { NetaSoftLogoFull, NetaSoftIcon } from "@/components/ui/NetaSoftLogo";

function GirisForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/panel";

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
    if (!formData.email) newErrors.email = "E-Posta Adresi Gereklidir";
    if (!formData.password) newErrors.password = "Şifre Gereklidir";
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
          general: "E-Posta Veya Şifre Hatalı. Lütfen Tekrar Deneyin.",
        });
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setErrors({ general: "Sunucu Hatası, Lütfen Tekrar Deneyin." });
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
          E-Posta Adresi
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className={`form-input ${errors.email ? "error" : ""}`}
          placeholder="ornek@eczane.com"
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
          Şifre
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
            aria-label={showPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
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
          Şifremi Unuttum
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
            Giriş Yapılıyor...
          </>
        ) : (
          "Giriş Yap"
        )}
      </button>
    </form>
  );
}

export default function GirisPage() {
  return (
    <div className="auth-page">
      {/* Sol taraf — Form */}
      <div className="auth-form-side">
        <div className="auth-form-container">
          <div className="auth-logo">
            <NetaSoftLogoFull size={44} />
          </div>

          <h1 className="auth-title">Tekrar Hoş Geldiniz</h1>
          <p className="auth-subtitle">
            Hesabınıza giriş yaparak finansal yönetiminize devam edin.
          </p>

          <Suspense fallback={
            <div style={{ padding: "20px", textAlign: "center" }}>
              <div className="spinner" style={{ margin: "0 auto" }} />
            </div>
          }>
            <GirisForm />
          </Suspense>

          <p className="auth-footer-text">
            Hesabınız Yok Mu?{" "}
            <Link href="/kayit" className="auth-link">
              Ücretsiz Kayıt Olun
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
            Eczanenizin Finansal<br />Yönetimi Artık Çok Kolay
          </h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "var(--font-size-lg)", maxWidth: "400px", lineHeight: 1.6 }} className="auth-visual-subtitle">
            Gelir-Gider Takibi, Fatura Yönetimi, Stok Kontrolü Ve Detaylı Raporlar Tek Platformda.
          </p>
          <div style={{ display: "flex", gap: "32px", justifyContent: "center", marginTop: "48px" }}>
            {[
              { label: "Aktif Eczane", value: "1.200+" },
              { label: "Aylık İşlem", value: "50K+" },
              { label: "Tasarruf", value: "%40" },
            ].map((stat) => (
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
