"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PartyPopper, AlertTriangle, Eye, EyeOff, CheckCircle2, Circle,
  BarChart3, FolderOpen, Lock, type LucideIcon,
} from "lucide-react";
import { NetaSoftLogoFull, NetaSoftIcon } from "@/components/ui/NetaSoftLogo";
import { calculatePasswordStrength } from "@/lib/validators/auth";
import { useLangContext } from "@/app/providers/LangProvider";

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

export default function KayitPage() {
  const router = useRouter();
  const { lang } = useLangContext();
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<FormData> & { general?: string }>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [kvkkError, setKvkkError] = useState("");

  const passwordStrength = calculatePasswordStrength(formData.password);

  const PASSWORD_RULES = [
    { label: lang === "en" ? "At Least 12 Characters" : "En Az 12 Karakter", test: (p: string) => p.length >= 12 },
    { label: lang === "en" ? "Uppercase Letter (A-Z)" : "Büyük Harf (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
    { label: lang === "en" ? "Lowercase Letter (a-z)" : "Küçük Harf (a-z)", test: (p: string) => /[a-z]/.test(p) },
    { label: lang === "en" ? "Number (0-9)" : "Rakam (0-9)", test: (p: string) => /[0-9]/.test(p) },
    { label: lang === "en" ? "Special Character (!@#$...)" : "Özel Karakter (!@#$...)", test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
  ];

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
    setErrors({});
    setKvkkError("");

    if (!kvkkAccepted) {
      setKvkkError(lang === "en"
        ? "You must accept the GDPR/Personal Data Protection Notice to create an account."
        : "Hesap oluşturmak için KVKK Aydınlatma Metni'ni kabul etmelisiniz.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/v1/auth/kayit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify(formData),
      });

      const data = await response.json() as { success: boolean; error?: string; data?: unknown };

      if (!response.ok || !data.success) {
        if (response.status === 409) {
          setErrors({ email: data.error ?? (lang === "en" ? "This email is already registered" : "Bu e-posta zaten kayıtlı") });
        } else if (response.status === 422) {
          setErrors({ general: data.error ?? (lang === "en" ? "Please check all fields" : "Lütfen tüm alanları kontrol edin") });
        } else {
          setErrors({ general: data.error ?? (lang === "en" ? "An error occurred" : "Bir hata oluştu") });
        }
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/giris?registered=true");
      }, 2000);
    } catch {
      setErrors({ general: lang === "en" ? "Server error, please try again." : "Sunucu hatası, lütfen tekrar deneyin." });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-form-side" style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease" }}>
            <div style={{ marginBottom: "24px", display: "flex", justifyContent: "center", color: "var(--color-success)" }}><PartyPopper size={72} /></div>
            <h2 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "12px", color: "var(--color-success)" }}>
              {lang === "en" ? "Account Created!" : "Hesabınız Oluşturuldu!"}
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
      {/* Sol taraf — Form */}
      <div className="auth-form-side">
        <div className="auth-form-container">
          <div className="auth-logo">
            <NetaSoftLogoFull size={44} />
          </div>

          <LangToggle />

          <h1 className="auth-title">
            {lang === "en" ? "Get Started Free" : "Ücretsiz Başlayın"}
          </h1>
          <p className="auth-subtitle">
            {lang === "en"
              ? "Create an account for your pharmacy and simplify financial management."
              : "Eczaneniz için hesap oluşturun, finansal yönetimi kolaylaştırın."}
          </p>

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
                gap: "8px",
              }}
            >
              <AlertTriangle size={15} style={{ flexShrink: 0 }} /> {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="pharmacyName" className="form-label required">
                {lang === "en" ? "Pharmacy Name" : "Eczane Adı"}
              </label>
              <input
                id="pharmacyName"
                name="pharmacyName"
                type="text"
                autoComplete="organization"
                className={`form-input ${errors.pharmacyName ? "error" : ""}`}
                placeholder={lang === "en" ? "e.g. Sun Pharmacy" : "Örn: Güneş Eczanesi"}
                value={formData.pharmacyName}
                onChange={handleChange}
                disabled={loading}
              />
              {errors.pharmacyName && (
                <span className="form-error" role="alert" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={12} /> {errors.pharmacyName}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="pharmacistName" className="form-label required">
                {lang === "en" ? "Pharmacist Full Name" : "Eczacı Adı Soyadı"}
              </label>
              <input
                id="pharmacistName"
                name="pharmacistName"
                type="text"
                autoComplete="name"
                className={`form-input ${errors.pharmacistName ? "error" : ""}`}
                placeholder={lang === "en" ? "e.g. John Smith" : "Örn: Ahmet Yılmaz"}
                value={formData.pharmacistName}
                onChange={handleChange}
                disabled={loading}
              />
              {errors.pharmacistName && (
                <span className="form-error" role="alert" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={12} /> {errors.pharmacistName}</span>
              )}
            </div>

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
                <span className="form-error" role="alert" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={12} /> {errors.email}</span>
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
                  autoComplete="new-password"
                  className={`form-input ${errors.password ? "error" : ""}`}
                  placeholder={lang === "en" ? "At Least 12 Characters" : "En Az 12 Karakter"}
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
                    color: "var(--color-text-muted)", fontSize: "18px",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <span className="form-error" role="alert" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={12} /> {errors.password}</span>
              )}

              {formData.password && (
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
                  className={`form-input ${errors.confirmPassword ? "error" : ""}`}
                  placeholder={lang === "en" ? "Re-enter Your Password" : "Şifrenizi Tekrar Girin"}
                  value={formData.confirmPassword}
                  onChange={handleChange}
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
              {errors.confirmPassword && (
                <span className="form-error" role="alert" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={12} /> {errors.confirmPassword}</span>
              )}
              {formData.confirmPassword && formData.password === formData.confirmPassword && (
                <span style={{ color: "var(--color-success)", fontSize: "var(--font-size-xs)", fontWeight: 500 }}>
                  ✓ {lang === "en" ? "Passwords Match" : "Şifreler Eşleşiyor"}
                </span>
              )}
            </div>

            <div className="form-group" style={{ marginTop: "var(--spacing-5)" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
                <input
                  type="checkbox"
                  id="kvkkAccepted"
                  checked={kvkkAccepted}
                  onChange={(e) => { setKvkkAccepted(e.target.checked); setKvkkError(""); }}
                  disabled={loading}
                  style={{ marginTop: "2px", width: "16px", height: "16px", flexShrink: 0, cursor: "pointer" }}
                />
                <span>
                  {lang === "en" ? "I have read and accept the " : "Kaydolmak için "}
                  <Link href="/kvkk" target="_blank" className="auth-link" onClick={(e) => e.stopPropagation()}>
                    {lang === "en" ? "GDPR/Personal Data Protection Notice" : "KVKK Aydınlatma Metni'ni"}
                  </Link>
                  {lang === "en" ? "." : " okudum ve kabul ediyorum."}
                </span>
              </label>
              {kvkkError && (
                <span className="form-error" role="alert" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={12} /> {kvkkError}</span>
              )}
            </div>

            <button
              type="submit"
              id="btn-register-submit"
              className="btn btn-primary btn-lg btn-full"
              style={{ marginTop: "var(--spacing-4)" }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18 }} />
                  {lang === "en" ? "Creating Account..." : "Hesap Oluşturuluyor..."}
                </>
              ) : (
                lang === "en" ? "Create Account" : "Hesap Oluştur"
              )}
            </button>
          </form>

          <p className="auth-footer-text">
            {lang === "en" ? "Already have an account?" : "Zaten hesabınız var mı?"}{" "}
            <Link href="/giris" className="auth-link">
              {lang === "en" ? "Sign In" : "Giriş Yapın"}
            </Link>
          </p>

          <p style={{
            textAlign: "center",
            fontSize: "var(--font-size-xs)",
            color: "var(--color-text-muted)",
            marginTop: "var(--spacing-4)",
            lineHeight: 1.6
          }}>
            {lang === "en" ? "By signing up you agree to our" : "Kaydolarak"}{" "}
            <Link href="/kullanim-kosullari" className="auth-link">
              {lang === "en" ? "Terms of Service" : "Kullanım Koşullarını"}
            </Link>{" "}
            {lang === "en" ? "and" : "ve"}{" "}
            <Link href="/kvkk" className="auth-link">
              {lang === "en" ? "GDPR/Personal Data Protection Notice" : "KVKK Aydınlatma Metni'ni"}
            </Link>
            {lang === "en" ? "." : " kabul etmiş olursunuz."}
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
            {lang === "en"
              ? <>Take Your Pharmacy<br />Digital</>
              : <>Eczanenizi Dijital<br />Dönüşüme Taşıyın</>}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.9)", fontSize: "var(--font-size-base)", maxWidth: "380px", lineHeight: 1.8 }}>
            {lang === "en"
              ? "No setup required. Start instantly from your browser."
              : "Kurulum gerektirmez. Tarayıcınızdan anında başlayın."}
          </p>

          <div style={{ marginTop: "48px", display: "flex", flexDirection: "column", gap: "16px", textAlign: "left" }}>
            {((lang === "en"
              ? [
                  { icon: BarChart3, title: "Real-Time Reports", desc: "See your financial status instantly" },
                  { icon: FolderOpen, title: "Smart File Import", desc: "Easily import your Excel/PDF data" },
                  { icon: Lock, title: "Bank-Level Security", desc: "Your data is encrypted and secure" },
                ]
              : [
                  { icon: BarChart3, title: "Gerçek Zamanlı Raporlar", desc: "Finansal durumunuzu anında görün" },
                  { icon: FolderOpen, title: "Akıllı Dosya İçe Aktarma", desc: "Excel/PDF verilerinizi kolayca aktarın" },
                  { icon: Lock, title: "Banka Düzeyinde Güvenlik", desc: "Verileriniz şifreli ve güvende" },
                ]
            ) as Array<{ icon: LucideIcon; title: string; desc: string }>).map((feature) => (
              <div key={feature.title} style={{
                display: "flex",
                gap: "16px",
                alignItems: "flex-start",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "var(--radius-md)",
                padding: "16px",
                backdropFilter: "blur(10px)",
              }}>
                <feature.icon size={26} style={{ flexShrink: 0 }} />
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
