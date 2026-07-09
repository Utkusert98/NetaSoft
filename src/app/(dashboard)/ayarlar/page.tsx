"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme, type Theme } from "@/lib/hooks/useTheme";
import { useLangContext } from "@/app/providers/LangProvider";
import { t, tx } from "@/lib/i18n/translations";

interface PharmacyData {
  id: string; name: string; taxNumber: string | null; licenseNumber: string | null;
  address: string | null; phone: string | null; email: string | null;
  city: string | null; district: string | null;
}

interface UserData {
  id: string; name: string | null; email: string; pharmacistName: string | null; createdAt: string;
}

type Tab = "eczane" | "profil" | "sifre" | "tema" | "dil";

function SuccessBanner({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div style={{ padding: "12px 16px", background: "#f0fce8", color: "#4e7c3f", border: "1px solid #9fe870", borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-4)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--font-size-sm)", fontWeight: 500 }}>
      ✅ {msg}
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700, fontSize: "16px" }}>✕</button>
    </div>
  );
}

function ErrorBanner({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div style={{ padding: "12px 16px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-4)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--font-size-sm)" }}>
      ⚠️ {msg}
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700, fontSize: "16px" }}>✕</button>
    </div>
  );
}

function Field({ label, name, value, onChange, type = "text", placeholder }: {
  label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder ?? ""} className="form-input" />
    </div>
  );
}

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const { lang } = useLangContext();
  const THEME_OPTIONS: { value: Theme; label: string; icon: string; desc: string }[] = [
    { value: "light", label: tx(t.settings.lightTheme, lang), icon: "☀️", desc: tx(t.settings.lightDesc, lang) },
    { value: "dark", label: tx(t.settings.darkTheme, lang), icon: "🌙", desc: tx(t.settings.darkDesc, lang) },
    { value: "system", label: tx(t.settings.systemTheme, lang), icon: "💻", desc: tx(t.settings.systemDesc, lang) },
  ];
  return (
    <div className="card">
      <h2 style={{ fontWeight: 700, marginBottom: "var(--spacing-2)" }}>{lang === "en" ? "Appearance Theme" : "Görünüm Teması"}</h2>
      <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginBottom: "var(--spacing-6)" }}>
        Tercih ettiğiniz temayı seçin. Ayar tarayıcıda kalıcı olarak saklanır.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
        {THEME_OPTIONS.map(opt => {
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              style={{
                display: "flex", alignItems: "center", gap: "var(--spacing-4)",
                padding: "var(--spacing-4) var(--spacing-5)",
                borderRadius: "var(--radius-lg)",
                border: `2px solid ${active ? "var(--color-primary-light)" : "var(--color-border)"}`,
                background: active ? "var(--color-primary-pale)" : "var(--color-bg)",
                cursor: "pointer", textAlign: "left", transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "28px", flexShrink: 0 }}>{opt.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: active ? 700 : 500, color: "var(--color-text)", fontSize: "var(--font-size-sm)", marginBottom: "2px" }}>
                  {opt.label}
                </p>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{opt.desc}</p>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                border: `2px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                background: active ? "var(--color-primary)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {active && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Önizleme */}
      <div style={{ marginTop: "var(--spacing-6)", padding: "var(--spacing-4)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg)" }}>
        <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--spacing-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{lang === "en" ? "Preview" : "Önizleme"}</p>
        <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "12px 16px", flex: 1 }}>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "4px" }}>Toplam Gelir</div>
            <div style={{ fontWeight: 700, color: "var(--color-primary)", fontSize: "var(--font-size-lg)" }}>₺12.500</div>
          </div>
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "12px 16px", flex: 1 }}>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "4px" }}>Net Kâr</div>
            <div style={{ fontWeight: 700, color: "#3498db", fontSize: "var(--font-size-lg)" }}>₺4.200</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const LANG_OPTIONS = [
  { value: "tr" as const, label: "Türkçe", icon: "🇹🇷", desc: "Tüm arayüz ve AI asistan Türkçe" },
  { value: "en" as const, label: "English", icon: "🇬🇧", desc: "All interface and AI assistant in English" },
];

function LangPicker() {
  const { lang, setLang } = useLangContext();
  return (
    <div className="card">
      <h2 style={{ fontWeight: 700, marginBottom: "var(--spacing-2)" }}>
        {lang === "en" ? "Language" : "Dil Seçimi"}
      </h2>
      <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginBottom: "var(--spacing-6)" }}>
        {lang === "en"
          ? "Choose your preferred language. This affects the entire interface including the AI assistant."
          : "Tercih ettiğiniz dili seçin. Bu ayar arayüzün tamamını ve AI asistanı etkiler."}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
        {LANG_OPTIONS.map(opt => {
          const active = lang === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setLang(opt.value)}
              style={{
                display: "flex", alignItems: "center", gap: "var(--spacing-4)",
                padding: "var(--spacing-4) var(--spacing-5)",
                borderRadius: "var(--radius-lg)",
                border: `2px solid ${active ? "var(--color-primary-light)" : "var(--color-border)"}`,
                background: active ? "var(--color-primary-pale)" : "var(--color-bg)",
                cursor: "pointer", textAlign: "left", transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "28px", flexShrink: 0 }}>{opt.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: active ? 700 : 500, color: "var(--color-text)", fontSize: "var(--font-size-sm)", marginBottom: "2px" }}>
                  {opt.label}
                </p>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{opt.desc}</p>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                border: `2px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                background: active ? "var(--color-primary)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {active && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AyarlarPage() {
  const { lang } = useLangContext();
  const [tab, setTab] = useState<Tab>("eczane");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Eczane
  const [pharmacy, setPharmacy] = useState<PharmacyData | null>(null);
  const [pharForm, setPharForm] = useState({ name: "", taxNumber: "", licenseNumber: "", address: "", phone: "", email: "", city: "", district: "" });

  // Profil
  const [user, setUser] = useState<UserData | null>(null);
  const [profileForm, setProfileForm] = useState({ name: "", pharmacistName: "" });

  // Şifre
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  const loadPharmacy = useCallback(async () => {
    const res = await fetch("/api/v1/ayarlar/eczane", { headers: { "Accept-Language": lang } });
    const json = await res.json() as { success: boolean; data?: PharmacyData };
    if (json.success && json.data) {
      setPharmacy(json.data);
      setPharForm({
        name: json.data.name ?? "",
        taxNumber: json.data.taxNumber ?? "",
        licenseNumber: json.data.licenseNumber ?? "",
        address: json.data.address ?? "",
        phone: json.data.phone ?? "",
        email: json.data.email ?? "",
        city: json.data.city ?? "",
        district: json.data.district ?? "",
      });
    }
  }, []);

  const loadUser = useCallback(async () => {
    const res = await fetch("/api/v1/ayarlar/profil", { headers: { "Accept-Language": lang } });
    const json = await res.json() as { success: boolean; data?: UserData };
    if (json.success && json.data) {
      setUser(json.data);
      setProfileForm({ name: json.data.name ?? "", pharmacistName: json.data.pharmacistName ?? "" });
    }
  }, []);

  useEffect(() => {
    void loadPharmacy();
    void loadUser();
  }, [loadPharmacy, loadUser]);

  const handlePharChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setPharForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setProfileForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handlePwChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setPwForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const savePharmacy = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/v1/ayarlar/eczane", { method: "PUT", headers: { "Content-Type": "application/json", "Accept-Language": lang }, body: JSON.stringify(pharForm) });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? "Kayıt hatası");
      setSuccess(tx(t.settings.updatePharmacy, lang));
      await loadPharmacy();
    } catch (err) { setError(err instanceof Error ? err.message : "Hata oluştu"); }
    finally { setSaving(false); }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/v1/ayarlar/profil", { method: "PUT", headers: { "Content-Type": "application/json", "Accept-Language": lang }, body: JSON.stringify(profileForm) });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? "Kayıt hatası");
      setSuccess(tx(t.settings.updateProfile, lang));
      await loadUser();
    } catch (err) { setError(err instanceof Error ? err.message : "Hata oluştu"); }
    finally { setSaving(false); }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/v1/ayarlar/profil", { method: "PUT", headers: { "Content-Type": "application/json", "Accept-Language": lang }, body: JSON.stringify({ action: "change-password", ...pwForm }) });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? "Hata oluştu");
      setSuccess(tx(t.settings.updatePassword, lang));
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) { setError(err instanceof Error ? err.message : "Hata oluştu"); }
    finally { setSaving(false); }
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "eczane", label: tx(t.settings.pharmacyTab, lang), icon: "🏥" },
    { key: "profil", label: tx(t.settings.profileTab, lang), icon: "👤" },
    { key: "sifre", label: tx(t.settings.passwordTab, lang), icon: "🔑" },
    { key: "tema", label: tx(t.settings.themeTab, lang), icon: "🎨" },
    { key: "dil", label: "Dil / Language", icon: "🌐" },
  ];

  return (
    <main className="page-content" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: "var(--spacing-6)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "var(--spacing-1)" }}>{tx(t.settings.title, lang)}</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>{tx(t.settings.subtitle, lang)}</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", borderBottom: "2px solid var(--color-border)", marginBottom: "var(--spacing-6)" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSuccess(""); setError(""); }}
            style={{
              padding: "10px 20px", background: "none", border: "none", cursor: "pointer",
              fontWeight: tab === t.key ? 700 : 500, fontSize: "var(--font-size-sm)",
              color: tab === t.key ? "var(--color-primary)" : "var(--color-text-muted)",
              borderBottom: tab === t.key ? "2px solid var(--color-primary)" : "2px solid transparent",
              marginBottom: "-2px", display: "flex", alignItems: "center", gap: "6px",
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {success && <SuccessBanner msg={success} onClose={() => setSuccess("")} />}
      {error && <ErrorBanner msg={error} onClose={() => setError("")} />}

      {/* ── Eczane Bilgileri ── */}
      {tab === "eczane" && (
        <div className="card">
          <div style={{ marginBottom: "var(--spacing-5)" }}>
            <h2 style={{ fontWeight: 700 }}>{tx(t.settings.pharmacyTab, lang)}</h2>
            {pharmacy && <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "4px" }}>ID: {pharmacy.id}</p>}
          </div>
          <form onSubmit={(e) => void savePharmacy(e)} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <Field label={tx(t.settings.pharmacyName, lang)} name="name" value={pharForm.name} onChange={handlePharChange} placeholder="Moda Sahil Eczanesi" />
            <div className="grid-2">
              <Field label={tx(t.settings.taxNumber, lang)} name="taxNumber" value={pharForm.taxNumber} onChange={handlePharChange} placeholder="1234567890" />
              <Field label={tx(t.settings.licenseNumber, lang)} name="licenseNumber" value={pharForm.licenseNumber} onChange={handlePharChange} placeholder="ECZ-2024-001" />
            </div>
            <div className="grid-2">
              <Field label={tx(t.settings.city, lang)} name="city" value={pharForm.city} onChange={handlePharChange} placeholder="İstanbul" />
              <Field label={tx(t.settings.district, lang)} name="district" value={pharForm.district} onChange={handlePharChange} placeholder="Kadıköy" />
            </div>
            <div className="form-group">
              <label className="form-label">Adres</label>
              <textarea name="address" value={pharForm.address} onChange={handlePharChange} className="form-input" rows={2} placeholder="Tam adres..." />
            </div>
            <div className="grid-2">
              <Field label={tx(t.settings.phone, lang)} name="phone" value={pharForm.phone} onChange={handlePharChange} placeholder="0212 555 00 00" />
              <Field label={tx(t.settings.email, lang)} name="email" value={pharForm.email} onChange={handlePharChange} type="email" placeholder="eczane@mail.com" />
            </div>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ alignSelf: "flex-start", minWidth: 160 }}>
              {saving ? tx(t.common.saving, lang) : tx(t.common.save, lang)}
            </button>
          </form>
        </div>
      )}

      {/* ── Profil ── */}
      {tab === "profil" && (
        <div className="card">
          <div style={{ marginBottom: "var(--spacing-5)" }}>
            <h2 style={{ fontWeight: 700 }}>{lang === "en" ? "Profile Information" : "Profil Bilgileri"}</h2>
            {user && <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "4px" }}>E-posta: {user.email}</p>}
          </div>

          {/* Avatar */}
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-4)", padding: "var(--spacing-4)", background: "var(--color-bg)", borderRadius: "var(--radius-lg)", marginBottom: "var(--spacing-5)" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, var(--color-primary), #9fe870)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 800, color: "white", flexShrink: 0 }}>
                {(user.name ?? user.email)[0].toUpperCase()}
              </div>
              <div>
                <p style={{ fontWeight: 700 }}>{user.name ?? "—"}</p>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{user.email}</p>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                  {lang === "en" ? "Registered" : "Kayıt"}: {new Date(user.createdAt).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR")}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={(e) => void saveProfile(e)} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <Field label={tx(t.settings.fullName, lang)} name="name" value={profileForm.name} onChange={handleProfileChange} placeholder="Ahmet Yılmaz" />
            <Field label={tx(t.settings.pharmacistTitle, lang)} name="pharmacistName" value={profileForm.pharmacistName} onChange={handleProfileChange} placeholder="Ecz. Ahmet Yılmaz" />
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ alignSelf: "flex-start", minWidth: 160 }}>
              {saving ? tx(t.common.saving, lang) : tx(t.common.save, lang)}
            </button>
          </form>
        </div>
      )}

      {/* ── Şifre ── */}
      {tab === "sifre" && (
        <div className="card">
          <div style={{ marginBottom: "var(--spacing-5)" }}>
            <h2 style={{ fontWeight: 700 }}>{lang === "en" ? "Change Password" : "Şifre Değiştir"}</h2>
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: "4px" }}>
              {lang === "en" ? "Use a strong password: at least 12 characters with uppercase, lowercase, numbers and special characters." : "Güçlü bir şifre kullanın: en az 12 karakter, büyük/küçük harf, rakam ve özel karakter içermeli."}
            </p>
          </div>
          <form onSubmit={(e) => void savePassword(e)} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <Field label={tx(t.settings.currentPassword, lang)} name="currentPassword" value={pwForm.currentPassword} onChange={handlePwChange} type="password" />
            <Field label={tx(t.settings.newPassword, lang)} name="newPassword" value={pwForm.newPassword} onChange={handlePwChange} type="password" placeholder="En az 12 karakter..." />
            <Field label={tx(t.settings.confirmPassword, lang)} name="confirmPassword" value={pwForm.confirmPassword} onChange={handlePwChange} type="password" />

            {/* Şifre gücü göstergesi */}
            {pwForm.newPassword.length > 0 && (
              <div style={{ padding: "12px 16px", background: "var(--color-bg)", borderRadius: "var(--radius-md)", fontSize: "var(--font-size-xs)" }}>
                <p style={{ fontWeight: 600, marginBottom: "6px" }}>{lang === "en" ? "Password Requirements" : "Şifre Gereksinimleri"}</p>
                {[
                  { ok: pwForm.newPassword.length >= 12, label: lang === "en" ? "At least 12 characters" : "En az 12 karakter" },
                  { ok: /[A-Z]/.test(pwForm.newPassword), label: lang === "en" ? "At least 1 uppercase letter" : "En az 1 büyük harf" },
                  { ok: /[a-z]/.test(pwForm.newPassword), label: lang === "en" ? "At least 1 lowercase letter" : "En az 1 küçük harf" },
                  { ok: /[0-9]/.test(pwForm.newPassword), label: lang === "en" ? "At least 1 number" : "En az 1 rakam" },
                  { ok: /[^A-Za-z0-9]/.test(pwForm.newPassword), label: lang === "en" ? "At least 1 special character (!@#$...)" : "En az 1 özel karakter (!@#$...)" },
                ].map(r => (
                  <div key={r.label} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px", color: r.ok ? "#4e7c3f" : "var(--color-text-muted)" }}>
                    {r.ok ? "✅" : "○"} {r.label}
                  </div>
                ))}
              </div>
            )}

            <button type="submit" disabled={saving} className="btn btn-primary" style={{ alignSelf: "flex-start", minWidth: 160 }}>
              {saving ? tx(t.common.saving, lang) : tx(t.settings.updateBtn, lang)}
            </button>
          </form>
        </div>
      )}

      {/* ── Tema ── */}
      {tab === "tema" && <ThemePicker />}

      {/* ── Dil ── */}
      {tab === "dil" && <LangPicker />}
    </main>
  );
}
