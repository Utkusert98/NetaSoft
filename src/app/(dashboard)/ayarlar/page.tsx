"use client";

import { useState, useEffect } from "react";
import { useTheme, type Theme } from "@/lib/hooks/useTheme";
import { useLangContext } from "@/app/providers/LangProvider";
import { t, tx } from "@/lib/i18n/translations";
import { getInitials } from "@/lib/utils";

interface PharmacyData {
  id: string; name: string; taxNumber: string | null; licenseNumber: string | null;
  address: string | null; phone: string | null; email: string | null;
  city: string | null; district: string | null;
}

interface UserData {
  id: string; name: string | null; email: string; pharmacistName: string | null; createdAt: string; image?: string | null;
}

interface TeamMember {
  userId: string; name: string | null; email: string; role: string; isActive: boolean;
}

type Tab = "eczane" | "profil" | "sifre" | "ekip" | "guvenlik" | "faturalama" | "tema" | "dil";

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
        {lang === "en" ? "Choose your preferred theme. The setting is stored permanently in the browser." : "Tercih ettiğiniz temayı seçin. Ayar tarayıcıda kalıcı olarak saklanır."}
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
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "4px" }}>{lang === "en" ? "Total Revenue" : "Toplam Gelir"}</div>
            <div style={{ fontWeight: 700, color: "var(--color-primary)", fontSize: "var(--font-size-lg)" }}>₺12.500</div>
          </div>
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "12px 16px", flex: 1 }}>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "4px" }}>{lang === "en" ? "Net Profit" : "Net Kâr"}</div>
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

const ROLE_LABELS: Record<string, { tr: string; en: string }> = {
  OWNER: { tr: "Sahip", en: "Owner" },
  ADMIN: { tr: "Yönetici", en: "Admin" },
  ACCOUNTANT: { tr: "Muhasebeci", en: "Accountant" },
  VIEWER: { tr: "İzleyici", en: "Viewer" },
};

function TeamPanel({ currentUserEmail, lang }: { currentUserEmail: string | undefined; lang: "tr" | "en" }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "VIEWER" });
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localSuccess, setLocalSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/v1/ayarlar/ekip", { headers: { "Accept-Language": lang } });
    const json = await res.json() as { success: boolean; data?: TeamMember[] };
    if (json.success && json.data) setMembers(json.data);
    setLoading(false);
  };

  // Async veri çekimi — setState await sonrası çalışır, senkron değildir.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [lang]);

  const me = members.find(m => m.email === currentUserEmail);
  const canManage = me?.role === "OWNER" || me?.role === "ADMIN";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setLocalError(""); setLocalSuccess("");
    try {
      const res = await fetch("/api/v1/ayarlar/ekip", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify(inviteForm),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? (lang === "en" ? "An error occurred" : "Hata oluştu"));
      setLocalSuccess(lang === "en" ? "Team member added." : "Ekip üyesi eklendi.");
      setInviteForm({ email: "", role: "VIEWER" });
      await load();
    } catch (err) { setLocalError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Hata oluştu")); }
    finally { setBusy(false); }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    setBusy(true); setLocalError(""); setLocalSuccess("");
    try {
      const res = await fetch("/api/v1/ayarlar/ekip", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({ userId, role }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? (lang === "en" ? "An error occurred" : "Hata oluştu"));
      await load();
    } catch (err) { setLocalError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Hata oluştu")); }
    finally { setBusy(false); }
  };

  const handleRemove = async (userId: string) => {
    setBusy(true); setLocalError(""); setLocalSuccess("");
    try {
      const res = await fetch(`/api/v1/ayarlar/ekip?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: { "Accept-Language": lang },
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? (lang === "en" ? "An error occurred" : "Hata oluştu"));
      setLocalSuccess(lang === "en" ? "Team member removed." : "Ekip üyesi çıkarıldı.");
      await load();
    } catch (err) { setLocalError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Hata oluştu")); }
    finally { setBusy(false); }
  };

  return (
    <div className="card">
      <div style={{ marginBottom: "var(--spacing-5)" }}>
        <h2 style={{ fontWeight: 700 }}>{tx(t.settings.teamTab, lang)}</h2>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: "4px" }}>
          {lang === "en" ? "Manage who has access to this pharmacy." : "Bu eczaneye kimlerin erişebileceğini yönetin."}
        </p>
      </div>

      {localError && <ErrorBanner msg={localError} onClose={() => setLocalError("")} />}
      {localSuccess && <SuccessBanner msg={localSuccess} onClose={() => setLocalSuccess("")} />}

      {loading ? (
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>{lang === "en" ? "Loading..." : "Yükleniyor..."}</p>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: "var(--spacing-5)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-size-sm)" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ padding: "8px" }}>{lang === "en" ? "Name" : "Ad"}</th>
                <th style={{ padding: "8px" }}>{lang === "en" ? "Email" : "E-posta"}</th>
                <th style={{ padding: "8px" }}>{lang === "en" ? "Role" : "Rol"}</th>
                <th style={{ padding: "8px" }}>{lang === "en" ? "Status" : "Durum"}</th>
                {canManage && <th style={{ padding: "8px" }}>{lang === "en" ? "Action" : "İşlem"}</th>}
              </tr>
            </thead>
            <tbody>
              {members.map(mem => (
                <tr key={mem.userId} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "8px" }}>{mem.name ?? "—"}</td>
                  <td style={{ padding: "8px" }}>{mem.email}</td>
                  <td style={{ padding: "8px" }}>
                    {canManage && mem.role !== "OWNER" ? (
                      <select
                        value={mem.role}
                        disabled={busy}
                        onChange={(e) => void handleRoleChange(mem.userId, e.target.value)}
                        className="form-input"
                        style={{ padding: "4px 8px", fontSize: "var(--font-size-xs)" }}
                      >
                        <option value="ADMIN">{ROLE_LABELS.ADMIN[lang]}</option>
                        <option value="ACCOUNTANT">{ROLE_LABELS.ACCOUNTANT[lang]}</option>
                        <option value="VIEWER">{ROLE_LABELS.VIEWER[lang]}</option>
                      </select>
                    ) : (
                      <span style={{ padding: "2px 10px", borderRadius: "999px", background: "var(--color-primary-pale)", color: "var(--color-primary)", fontSize: "var(--font-size-xs)", fontWeight: 600 }}>
                        {ROLE_LABELS[mem.role]?.[lang] ?? mem.role}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "8px" }}>
                    {mem.isActive ? (lang === "en" ? "Active" : "Aktif") : (lang === "en" ? "Inactive" : "Pasif")}
                  </td>
                  {canManage && (
                    <td style={{ padding: "8px" }}>
                      {mem.role !== "OWNER" && (
                        <button
                          disabled={busy}
                          onClick={() => void handleRemove(mem.userId)}
                          className="btn"
                          style={{ padding: "4px 10px", fontSize: "var(--font-size-xs)", color: "var(--color-danger)", border: "1px solid var(--color-danger)", background: "transparent" }}
                        >
                          {lang === "en" ? "Remove" : "Çıkar"}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--spacing-5)" }}>
          <h3 style={{ fontWeight: 700, marginBottom: "var(--spacing-3)", fontSize: "var(--font-size-sm)" }}>
            {lang === "en" ? "Add Team Member" : "Ekip Üyesi Ekle"}
          </h3>
          <form onSubmit={(e) => void handleInvite(e)} style={{ display: "flex", gap: "var(--spacing-3)", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">{lang === "en" ? "Email" : "E-posta"}</label>
              <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))} className="form-input" placeholder="ornek@mail.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">{lang === "en" ? "Role" : "Rol"}</label>
              <select value={inviteForm.role} onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value }))} className="form-input">
                <option value="VIEWER">{ROLE_LABELS.VIEWER[lang]}</option>
                <option value="ACCOUNTANT">{ROLE_LABELS.ACCOUNTANT[lang]}</option>
                <option value="ADMIN">{ROLE_LABELS.ADMIN[lang]}</option>
              </select>
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary">
              {lang === "en" ? "Add" : "Ekle"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function SecurityPanel({ lang }: { lang: "tr" | "en" }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"idle" | "setup" | "confirmed">("idle");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localSuccess, setLocalSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/v1/ayarlar/guvenlik", { headers: { "Accept-Language": lang } });
    const json = await res.json() as { success: boolean; data?: { twoFactorEnabled: boolean } };
    if (json.success && json.data) setEnabled(json.data.twoFactorEnabled);
    setLoading(false);
  };

  // Async veri çekimi — setState await sonrası çalışır, senkron değildir.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [lang]);

  const startSetup = async () => {
    setBusy(true); setLocalError(""); setLocalSuccess("");
    try {
      const res = await fetch("/api/v1/ayarlar/guvenlik", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({ action: "setup" }),
      });
      const json = await res.json() as { success: boolean; error?: string; data?: { qrCodeDataUrl: string; secret: string } };
      if (!json.success || !json.data) throw new Error(json.error ?? (lang === "en" ? "An error occurred" : "Hata oluştu"));
      setQrCodeDataUrl(json.data.qrCodeDataUrl);
      setSecret(json.data.secret);
      setStep("setup");
    } catch (err) { setLocalError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Hata oluştu")); }
    finally { setBusy(false); }
  };

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setLocalError(""); setLocalSuccess("");
    try {
      const res = await fetch("/api/v1/ayarlar/guvenlik", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({ action: "confirm", code }),
      });
      const json = await res.json() as { success: boolean; error?: string; data?: { backupCodes: string[] } };
      if (!json.success || !json.data) throw new Error(json.error ?? (lang === "en" ? "An error occurred" : "Hata oluştu"));
      setBackupCodes(json.data.backupCodes);
      setStep("confirmed");
      setEnabled(true);
    } catch (err) { setLocalError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Hata oluştu")); }
    finally { setBusy(false); }
  };

  const disable2fa = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setLocalError(""); setLocalSuccess("");
    try {
      const res = await fetch("/api/v1/ayarlar/guvenlik", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({ action: "disable", currentPassword: disablePassword }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? (lang === "en" ? "An error occurred" : "Hata oluştu"));
      setEnabled(false);
      setShowDisableForm(false);
      setDisablePassword("");
      setStep("idle");
      setLocalSuccess(lang === "en" ? "Two-factor authentication disabled." : "İki adımlı doğrulama devre dışı bırakıldı.");
    } catch (err) { setLocalError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Hata oluştu")); }
    finally { setBusy(false); }
  };

  return (
    <div className="card">
      <div style={{ marginBottom: "var(--spacing-5)" }}>
        <h2 style={{ fontWeight: 700 }}>{tx(t.settings.securityTab, lang)}</h2>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: "4px" }}>
          {lang === "en" ? "Add an extra layer of security to your account with two-factor authentication." : "İki adımlı doğrulama ile hesabınıza ekstra bir güvenlik katmanı ekleyin."}
        </p>
      </div>

      {localError && <ErrorBanner msg={localError} onClose={() => setLocalError("")} />}
      {localSuccess && <SuccessBanner msg={localSuccess} onClose={() => setLocalSuccess("")} />}

      {loading ? (
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>{lang === "en" ? "Loading..." : "Yükleniyor..."}</p>
      ) : (
        <>
          {!enabled && step === "idle" && (
            <div>
              <p style={{ fontSize: "var(--font-size-sm)", marginBottom: "var(--spacing-4)" }}>
                {lang === "en" ? "Two-factor authentication is currently disabled." : "İki adımlı doğrulama şu anda devre dışı."}
              </p>
              <button onClick={() => void startSetup()} disabled={busy} className="btn btn-primary">
                {lang === "en" ? "Enable" : "Etkinleştir"}
              </button>
            </div>
          )}

          {step === "setup" && (
            <form onSubmit={(e) => void confirmSetup(e)} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
              <p style={{ fontSize: "var(--font-size-sm)" }}>
                {lang === "en" ? "Scan the QR code with an authenticator app (Google Authenticator, Authy...) or enter the secret manually." : "QR kodunu bir doğrulayıcı uygulama (Google Authenticator, Authy vb.) ile tarayın veya gizli anahtarı manuel girin."}
              </p>
              {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="2FA QR" style={{ width: 180, height: 180 }} />}
              <div style={{ fontFamily: "monospace", fontSize: "var(--font-size-sm)", background: "var(--color-bg)", padding: "8px 12px", borderRadius: "var(--radius-md)", wordBreak: "break-all" }}>
                {secret}
              </div>
              <Field label={lang === "en" ? "6-Digit Code" : "6 Haneli Kod"} name="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
              <button type="submit" disabled={busy} className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
                {lang === "en" ? "Confirm" : "Onayla"}
              </button>
            </form>
          )}

          {step === "confirmed" && backupCodes.length > 0 && (
            <div>
              <p style={{ fontWeight: 700, marginBottom: "var(--spacing-2)" }}>
                {lang === "en" ? "Two-factor authentication is now active." : "İki adımlı doğrulama artık aktif."}
              </p>
              <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-danger)", marginBottom: "var(--spacing-3)" }}>
                {lang === "en" ? "Save these codes somewhere safe, they will not be shown again." : "Bu kodları güvenli bir yerde saklayın, tekrar gösterilmeyecek."}
              </p>
              <div style={{ fontFamily: "monospace", fontSize: "var(--font-size-sm)", background: "var(--color-bg)", padding: "12px 16px", borderRadius: "var(--radius-md)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                {backupCodes.map(c => <span key={c}>{c}</span>)}
              </div>
            </div>
          )}

          {enabled && step !== "confirmed" && (
            <div>
              <p style={{ fontSize: "var(--font-size-sm)", marginBottom: "var(--spacing-4)", color: "var(--color-income-green)", fontWeight: 600 }}>
                {lang === "en" ? "Two-factor authentication is active." : "İki adımlı doğrulama aktif."}
              </p>
              {!showDisableForm ? (
                <button onClick={() => setShowDisableForm(true)} className="btn" style={{ border: "1px solid var(--color-danger)", color: "var(--color-danger)", background: "transparent" }}>
                  {lang === "en" ? "Disable" : "Devre Dışı Bırak"}
                </button>
              ) : (
                <form onSubmit={(e) => void disable2fa(e)} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)", maxWidth: 320 }}>
                  <Field label={tx(t.settings.currentPassword, lang)} name="disablePassword" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} type="password" />
                  <button type="submit" disabled={busy} className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
                    {lang === "en" ? "Confirm Disable" : "Devre Dışı Bırakmayı Onayla"}
                  </button>
                </form>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BillingPanel({ lang }: { lang: "tr" | "en" }) {
  return (
    <div className="card">
      <div style={{ marginBottom: "var(--spacing-5)" }}>
        <h2 style={{ fontWeight: 700 }}>{tx(t.settings.billingTab, lang)}</h2>
      </div>
      <p style={{ fontSize: "var(--font-size-sm)", marginBottom: "var(--spacing-2)" }}>
        <strong>{lang === "en" ? "Current Plan:" : "Mevcut Plan:"}</strong> {lang === "en" ? "Standard" : "Standart"}
      </p>
      <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginBottom: "var(--spacing-5)" }}>
        {lang === "en" ? "Billing and subscription management will be available soon." : "Faturalama ve abonelik yönetimi yakında kullanıma sunulacaktır."}
      </p>
      <button disabled className="btn" style={{ opacity: 0.5, cursor: "not-allowed" }}>
        {lang === "en" ? "Manage Plan (Coming Soon)" : "Planı Yönet (Yakında)"}
      </button>
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
  const [profileForm, setProfileForm] = useState({ name: "", pharmacistName: "", email: "", currentPassword: "", image: "" });

  // Şifre
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  const loadPharmacy = async () => {
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
  };

  const loadUser = async () => {
    const res = await fetch("/api/v1/ayarlar/profil", { headers: { "Accept-Language": lang } });
    const json = await res.json() as { success: boolean; data?: UserData };
    if (json.success && json.data) {
      setUser(json.data);
      setProfileForm({ name: json.data.name ?? "", pharmacistName: json.data.pharmacistName ?? "", email: json.data.email ?? "", currentPassword: "", image: json.data.image ?? "" });
    }
  };

  useEffect(() => {
    // Async veri çekimi — setState await sonrası çalışır, senkron değildir.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPharmacy();
    void loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

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
      if (!json.success) throw new Error(json.error ?? (lang === "en" ? "Save error" : "Kayıt hatası"));
      setSuccess(tx(t.settings.updatePharmacy, lang));
      await loadPharmacy();
    } catch (err) { setError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Hata oluştu")); }
    finally { setSaving(false); }
  };

  const emailChanged = user !== null && profileForm.email !== user.email;

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm(prev => ({ ...prev, image: typeof reader.result === "string" ? reader.result : prev.image }));
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const payload: Record<string, string> = { name: profileForm.name, pharmacistName: profileForm.pharmacistName, image: profileForm.image };
      if (emailChanged) {
        payload.email = profileForm.email;
        payload.currentPassword = profileForm.currentPassword;
      }
      const res = await fetch("/api/v1/ayarlar/profil", { method: "PUT", headers: { "Content-Type": "application/json", "Accept-Language": lang }, body: JSON.stringify(payload) });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? (lang === "en" ? "Save error" : "Kayıt hatası"));
      setSuccess(tx(t.settings.updateProfile, lang));
      await loadUser();
    } catch (err) { setError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Hata oluştu")); }
    finally { setSaving(false); }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/v1/ayarlar/profil", { method: "PUT", headers: { "Content-Type": "application/json", "Accept-Language": lang }, body: JSON.stringify({ action: "change-password", ...pwForm }) });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? (lang === "en" ? "An error occurred" : "Hata oluştu"));
      setSuccess(tx(t.settings.updatePassword, lang));
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) { setError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Hata oluştu")); }
    finally { setSaving(false); }
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "eczane", label: tx(t.settings.pharmacyTab, lang), icon: "🏥" },
    { key: "profil", label: tx(t.settings.profileTab, lang), icon: "👤" },
    { key: "sifre", label: tx(t.settings.passwordTab, lang), icon: "🔑" },
    { key: "ekip", label: tx(t.settings.teamTab, lang), icon: "👥" },
    { key: "guvenlik", label: tx(t.settings.securityTab, lang), icon: "🛡️" },
    { key: "faturalama", label: tx(t.settings.billingTab, lang), icon: "💳" },
    { key: "tema", label: tx(t.settings.themeTab, lang), icon: "🎨" },
    { key: "dil", label: lang === "en" ? "Language" : "Dil / Language", icon: "🌐" },
  ];

  return (
    <main className="page-content" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: "var(--spacing-6)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "var(--spacing-1)" }}>{tx(t.settings.title, lang)}</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>{tx(t.settings.subtitle, lang)}</p>
      </div>

      {/* Tabs — mobilde 5 sekme tek satıra sığmadığından yatay kaydırmalı,
          taşan sekmeler sayfayı genişletmesin diye flex-shrink:0 + nowrap */}
      <div style={{
        display: "flex", gap: "4px", borderBottom: "2px solid var(--color-border)",
        marginBottom: "var(--spacing-6)", overflowX: "auto", WebkitOverflowScrolling: "touch",
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSuccess(""); setError(""); }}
            style={{
              padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
              fontWeight: tab === t.key ? 700 : 500, fontSize: "var(--font-size-sm)",
              color: tab === t.key ? "var(--color-primary)" : "var(--color-text-muted)",
              borderBottom: tab === t.key ? "2px solid var(--color-primary)" : "2px solid transparent",
              marginBottom: "-2px", display: "flex", alignItems: "center", gap: "6px",
              flexShrink: 0, whiteSpace: "nowrap",
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
              <label className="form-label">{lang === "en" ? "Address" : "Adres"}</label>
              <textarea name="address" value={pharForm.address} onChange={handlePharChange} className="form-input" rows={2} placeholder={lang === "en" ? "Full address..." : "Tam adres..."} />
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
            {user && <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "4px" }}>{lang === "en" ? "Email:" : "E-posta:"} {user.email}</p>}
          </div>

          {/* Avatar */}
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-4)", padding: "var(--spacing-4)", background: "var(--color-bg)", borderRadius: "var(--radius-lg)", marginBottom: "var(--spacing-5)" }}>
              {profileForm.image ? (
                <img src={profileForm.image} alt="Avatar" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, var(--color-primary), #9fe870)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 800, color: "white", flexShrink: 0 }}>
                  {getInitials(user.name ?? user.email)}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700 }}>{user.name ?? "—"}</p>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{user.email}</p>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                  {lang === "en" ? "Registered:" : "Kayıt:"} {new Date(user.createdAt).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR")}
                </p>
              </div>
              <div>
                <input type="file" accept="image/*" id="avatar-input" style={{ display: "none" }} onChange={handleAvatarSelect} />
                <label htmlFor="avatar-input" className="btn" style={{ cursor: "pointer", fontSize: "var(--font-size-xs)" }}>
                  {lang === "en" ? "Change Photo" : "Fotoğraf Değiştir"}
                </label>
              </div>
            </div>
          )}

          <form onSubmit={(e) => void saveProfile(e)} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <Field label={tx(t.settings.fullName, lang)} name="name" value={profileForm.name} onChange={handleProfileChange} placeholder="Ahmet Yılmaz" />
            <Field label={tx(t.settings.pharmacistTitle, lang)} name="pharmacistName" value={profileForm.pharmacistName} onChange={handleProfileChange} placeholder="Ecz. Ahmet Yılmaz" />
            <Field label={tx(t.settings.email, lang)} name="email" value={profileForm.email} onChange={handleProfileChange} type="email" placeholder="ornek@mail.com" />
            {emailChanged && (
              <Field label={tx(t.settings.currentPassword, lang)} name="currentPassword" value={profileForm.currentPassword} onChange={handleProfileChange} type="password" placeholder={lang === "en" ? "Required to change email" : "E-posta değiştirmek için gerekli"} />
            )}
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
            <Field label={tx(t.settings.newPassword, lang)} name="newPassword" value={pwForm.newPassword} onChange={handlePwChange} type="password" placeholder={lang === "en" ? "At least 12 characters..." : "En az 12 karakter..."} />
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
                  <div key={r.label} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px", color: r.ok ? "var(--color-income-green)" : "var(--color-text-muted)" }}>
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

      {/* ── Ekip ── */}
      {tab === "ekip" && <TeamPanel currentUserEmail={user?.email} lang={lang} />}

      {/* ── Güvenlik (2FA) ── */}
      {tab === "guvenlik" && <SecurityPanel lang={lang} />}

      {/* ── Faturalama ── */}
      {tab === "faturalama" && <BillingPanel lang={lang} />}

      {/* ── Tema ── */}
      {tab === "tema" && <ThemePicker />}

      {/* ── Dil ── */}
      {tab === "dil" && <LangPicker />}
    </main>
  );
}
