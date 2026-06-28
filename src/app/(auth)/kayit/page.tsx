"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NetaSoftLogoFull, NetaSoftIcon } from "@/components/ui/NetaSoftLogo";
import { calculatePasswordStrength } from "@/lib/validators/auth";

interface FormData {
  pharmacyName: string;
  pharmacistName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const INITIAL_FORM: FormData = {
  pharmacyName: "",
  pharmacistName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const PASSWORD_RULES = [
  { label: "En Az 12 Karakter", test: (p: string) => p.length >= 12 },
  { label: "Büyük Harf (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Küçük Harf (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { label: "Rakam (0-9)", test: (p: string) => /[0-9]/.test(p) },
  { label: "Özel Karakter (!@#$...)", test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

export default function KayitPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<FormData> & { general?: string }>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordStrength = calculatePasswordStrength(formData.password);

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

    try {
      const response = await fetch("/api/v1/auth/kayit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json() as { success: boolean; error?: string; data?: unknown };

      if (!response.ok || !data.success) {
        if (response.status === 409) {
          setErrors({ email: data.error ?? "Bu e-posta zaten kayıtlı" });
        } else if (response.status === 422) {
          // Zod validasyon hatası
          setErrors({ general: data.error ?? "Lütfen tüm alanları kontrol edin" });
        } else {
          setErrors({ general: data.error ?? "Bir hata oluştu" });
        }
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/giris?registered=true");
      }, 2000);
    } catch {
      setErrors({ general: "Sunucu hatası, lütfen tekrar deneyin." });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-form-side" style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease" }}>
            <div style={{ fontSize: "80px", marginBottom: "24px" }}>🎉</div>
            <h2 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "12px", color: "var(--color-success)" }}>
              Hesabınız Oluşturuldu!
            </h2>
            <p style={{ color: "var(--color-text-muted)" }}>Giriş sayfasına yönlendiriliyorsunuz...</p>
          </div>
        </div>
        <div className="auth-visual-side" />
      </div>
    );
  }

  return (
    <div className="auth-page">
      {/* Sol taraf — Form */}
      <div className="auth-form-side">
        <div className="auth-form-container">
          <div className="auth-logo">
            <NetaSoftLogoFull size={44} />
          </div>

          <h1 className="auth-title">Ücretsiz Başlayın</h1>
          <p className="auth-subtitle">
            Eczaneniz için hesap oluşturun, finansal yönetimi kolaylaştırın.
          </p>

          {/* Genel Hata */}
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
              }}
            >
              ⚠️ {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Eczane Adı */}
            <div className="form-group">
              <label htmlFor="pharmacyName" className="form-label required">
                Eczane Adı
              </label>
              <input
                id="pharmacyName"
                name="pharmacyName"
                type="text"
                autoComplete="organization"
                className={`form-input ${errors.pharmacyName ? "error" : ""}`}
                placeholder="Örn: Güneş Eczanesi"
                value={formData.pharmacyName}
                onChange={handleChange}
                disabled={loading}
              />
              {errors.pharmacyName && (
                <span className="form-error" role="alert">⚠ {errors.pharmacyName}</span>
              )}
            </div>

            {/* Eczacı Adı */}
            <div className="form-group">
              <label htmlFor="pharmacistName" className="form-label required">
                Eczacı Adı Soyadı
              </label>
              <input
                id="pharmacistName"
                name="pharmacistName"
                type="text"
                autoComplete="name"
                className={`form-input ${errors.pharmacistName ? "error" : ""}`}
                placeholder="Örn: Ahmet Yılmaz"
                value={formData.pharmacistName}
                onChange={handleChange}
                disabled={loading}
              />
              {errors.pharmacistName && (
                <span className="form-error" role="alert">⚠ {errors.pharmacistName}</span>
              )}
            </div>

            {/* E-Posta */}
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

            {/* Şifre */}
            <div className="form-group">
              <label htmlFor="password" className="form-label required">
                Şifre
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={`form-input ${errors.password ? "error" : ""}`}
                  placeholder="En Az 12 Karakter"
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
                    color: "var(--color-text-muted)", fontSize: "18px",
                  }}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
              {errors.password && (
                <span className="form-error" role="alert">⚠ {errors.password}</span>
              )}

              {/* Şifre güç göstergesi */}
              {formData.password && (
                <div className="password-strength">
                  <div className="password-strength-bar">
                    <div
                      className={`password-strength-fill strength-${passwordStrength.score}`}
                      role="progressbar"
                      aria-valuenow={passwordStrength.score}
                      aria-valuemin={0}
                      aria-valuemax={5}
                      aria-label="Şifre Gücü"
                    />
                  </div>
                  <div className="password-strength-label" style={{ color: passwordStrength.color }}>
                    Şifre Gücü: {passwordStrength.label}
                  </div>

                  {/* Şifre kuralları listesi */}
                  <div style={{
                    marginTop: "var(--spacing-3)",
                    padding: "var(--spacing-3)",
                    background: "var(--color-bg)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)"
                  }}>
                    {PASSWORD_RULES.map((rule) => {
                      const ok = rule.test(formData.password);
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

            {/* Şifre Onayı */}
            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label required">
                Şifre Tekrarı
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  className={`form-input ${errors.confirmPassword ? "error" : ""}`}
                  placeholder="Şifrenizi Tekrar Girin"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={loading}
                  style={{ paddingRight: "48px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  aria-label={showConfirm ? "Şifreyi Gizle" : "Şifreyi Göster"}
                  style={{
                    position: "absolute", right: "12px", top: "50%",
                    transform: "translateY(-50%)", background: "none",
                    border: "none", cursor: "pointer",
                    color: "var(--color-text-muted)", fontSize: "18px",
                  }}
                >
                  {showConfirm ? "🙈" : "👁"}
                </button>
              </div>
              {errors.confirmPassword && (
                <span className="form-error" role="alert">⚠ {errors.confirmPassword}</span>
              )}
              {formData.confirmPassword && formData.password === formData.confirmPassword && (
                <span style={{ color: "var(--color-success)", fontSize: "var(--font-size-xs)", fontWeight: 500 }}>
                  ✓ Şifreler Eşleşiyor
                </span>
              )}
            </div>

            <button
              type="submit"
              id="btn-register-submit"
              className="btn btn-primary btn-lg btn-full"
              style={{ marginTop: "var(--spacing-6)" }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18 }} />
                  Hesap Oluşturuluyor...
                </>
              ) : (
                "Hesap Oluştur"
              )}
            </button>
          </form>

          <p className="auth-footer-text">
            Zaten hesabınız var mı?{" "}
            <Link href="/giris" className="auth-link">Giriş Yapın</Link>
          </p>

          <p style={{
            textAlign: "center",
            fontSize: "var(--font-size-xs)",
            color: "var(--color-text-muted)",
            marginTop: "var(--spacing-4)",
            lineHeight: 1.6
          }}>
            Kaydolarak{" "}
            <Link href="/kullanim-kosullari" className="auth-link">Kullanım Koşullarını</Link>{" "}
            ve{" "}
            <Link href="/gizlilik-politikasi" className="auth-link">Gizlilik Politikasını</Link>{" "}
            kabul etmiş olursunuz.
          </p>
        </div>
      </div>

      {/* Sağ taraf — Görsel */}
      <div className="auth-visual-side">
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", color: "white" }}>
          <div style={{ marginBottom: "40px" }}>
            <NetaSoftIcon size={96} variant="white" />
          </div>
          <h2 style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, marginBottom: "16px", lineHeight: 1.2, color: "white" }}>
            Eczanenizi Dijital<br />Dönüşüme Taşıyın
          </h2>
          <p style={{ color: "rgba(255,255,255,0.9)", fontSize: "var(--font-size-base)", maxWidth: "380px", lineHeight: 1.8 }}>
            Kurulum gerektirmez. Tarayıcınızdan anında başlayın.
          </p>

          <div style={{ marginTop: "48px", display: "flex", flexDirection: "column", gap: "16px", textAlign: "left" }}>
            {[
              { icon: "📊", title: "Gerçek Zamanlı Raporlar", desc: "Finansal durumunuzu anında görün" },
              { icon: "📁", title: "Akıllı Dosya İçe Aktarma", desc: "Excel/PDF verilerinizi kolayca aktarın" },
              { icon: "🔒", title: "Banka Düzeyinde Güvenlik", desc: "Verileriniz şifreli ve güvende" },
            ].map((feature) => (
              <div key={feature.title} style={{
                display: "flex",
                gap: "16px",
                alignItems: "flex-start",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "var(--radius-md)",
                padding: "16px",
                backdropFilter: "blur(10px)",
              }}>
                <span style={{ fontSize: "28px", flexShrink: 0 }}>{feature.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: "4px" }}>{feature.title}</div>
                  <div style={{ fontSize: "var(--font-size-sm)", opacity: 0.7 }}>{feature.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
