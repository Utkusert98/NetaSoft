"use client";
import { useLangContext } from "@/app/providers/LangProvider";
import { t, tx } from "@/lib/i18n/translations";

import { useState, useEffect, useCallback } from "react";
import { format, addDays } from "date-fns";
import { tr } from "date-fns/locale";

const PLATFORM_SUGGESTIONS = ["Farmazon", "Capsule", "Nora", "Pharmy", "ePlatform", "Diğer"];

type PlatformIncome = {
  id: string;
  platformName: string;
  amount: number;
  incomeDate: string;
  expectedPaymentDate: string;
  status: "PENDING" | "RECEIVED" | "CANCELLED";
  notes?: string;
};

const STATUS_MAP = {
  PENDING:   { label: "Bekliyor",     color: "#d97706", bg: "rgba(217,119,6,0.1)" },
  RECEIVED:  { label: "Hesaba Yattı", color: "#059669", bg: "rgba(5,150,105,0.1)" },
  CANCELLED: { label: "İptal",        color: "#dc2626", bg: "rgba(220,38,38,0.1)" },
};

const emptyForm = {
  platformName: "",
  amount: "",
  incomeDate: new Date().toISOString().split("T")[0],
  notes: "",
};

export default function PlatformGelirPage() {
  const { lang } = useLangContext();
  const [incomes, setIncomes] = useState<PlatformIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState("");

  const [editRecord, setEditRecord] = useState<PlatformIncome | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchIncomes = useCallback(async () => {
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/v1/finans/platform-gelir${qs}`);
      const json = await res.json();
      if (json.success) setIncomes(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchIncomes(); }, [fetchIncomes]);

  // +15 gün önizlemesi
  const previewPaymentDate = formData.incomeDate
    ? format(addDays(new Date(formData.incomeDate + "T00:00:00"), 15), "dd MMMM yyyy", { locale: tr })
    : "—";

  const editPreviewDate = editForm.incomeDate
    ? format(addDays(new Date(editForm.incomeDate + "T00:00:00"), 15), "dd MMMM yyyy", { locale: tr })
    : "—";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = { ...formData, amount: parseFloat(formData.amount) };
      const res = await fetch("/api/v1/finans/platform-gelir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Bir hata oluştu");
      setFormData(emptyForm);
      await fetchIncomes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (inc: PlatformIncome) => {
    setEditRecord(inc);
    setEditForm({
      platformName: inc.platformName,
      amount: String(inc.amount),
      incomeDate: new Date(inc.incomeDate).toISOString().split("T")[0],
      notes: inc.notes || "",
    });
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord) return;
    setEditSubmitting(true);
    try {
      const payload = { ...editForm, amount: parseFloat(editForm.amount) };
      const res = await fetch(`/api/v1/finans/platform-gelir/${editRecord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Bir hata oluştu");
      setEditRecord(null);
      await fetchIncomes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/v1/finans/platform-gelir/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Durum güncellenemedi");
      await fetchIncomes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/v1/finans/platform-gelir/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silme işlemi başarısız");
      setDeleteId(null);
      await fetchIncomes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const fmt = (v: number) => Number(v).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });

  const totalPending = incomes
    .filter(i => i.status === "PENDING")
    .reduce((a, i) => a + Number(i.amount), 0);

  return (
    <div style={{ padding: "var(--spacing-8)", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "var(--spacing-6)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700 }}>{tx(t.platform.title, lang)}</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "14px", marginTop: "4px" }}>
          Farmazon, Capsule vb. platformlardan gelen gelirleri takip edin. Giriş tarihinden 15 gün sonra hesaba yatar.
        </p>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "24px", fontSize: "14px" }}>
          {error}
          <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Summary Card */}
      {incomes.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
          {[
            { label: "Bekleyen Toplam", value: totalPending, color: "#d97706" },
            { label: "Toplam Kayıt", value: incomes.length, isCnt: true, color: "var(--color-primary)" },
            { label: "Yatacak Kayıt", value: incomes.filter(i => i.status === "PENDING").length, isCnt: true, color: "#7c3aed" },
          ].map((s, i) => (
            <div key={i} className="card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: s.color, marginTop: "4px" }}>
                {s.isCnt ? s.value : fmt(s.value as number)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "var(--spacing-8)", alignItems: "start" }}>
        {/* FORM */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-5)" }}>
            💸 Yeni Platform Geliri
          </h2>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <div className="form-group">
              <label className="form-label">{lang === "en" ? "Platform Name" : "Platform Adı"}</label>
              <input
                list="platform-suggestions"
                className="form-input"
                name="platformName"
                value={formData.platformName}
                onChange={handleChange}
                required
                placeholder="Farmazon, Capsule..."
              />
              <datalist id="platform-suggestions">
                {PLATFORM_SUGGESTIONS.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>

            <div className="form-group">
              <label className="form-label">Tutar (₺)</label>
              <input type="number" step="0.01" min="0.01" className="form-input" name="amount" value={formData.amount} onChange={handleChange} required placeholder="0,00" />
            </div>

            <div className="form-group">
              <label className="form-label">Giriş Tarihi</label>
              <input type="date" className="form-input" name="incomeDate" value={formData.incomeDate} onChange={handleChange} required />
            </div>

            {/* Otomatik ödeme tarihi önizlemesi */}
            <div style={{
              padding: "14px 16px",
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(109,40,217,0.05))",
              border: "1px solid rgba(124,58,237,0.25)",
            }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                ⏳ Tahmini Ödeme Tarihi (+15 Gün)
              </p>
              <p style={{ fontSize: "20px", fontWeight: 700, color: "#7c3aed" }}>
                {previewPaymentDate}
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Notlar</label>
              <textarea className="form-input" name="notes" value={formData.notes} onChange={handleChange} rows={2} placeholder="İsteğe bağlı..." />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? "Kaydediliyor..." : "+ Platform Geliri Ekle"}
            </button>
          </form>
        </div>

        {/* TABLE */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-4)" }}>
            <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600 }}>Bekleyen Gelirler</h2>
            <select
              className="form-input"
              style={{ width: "140px", fontSize: "13px" }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">Tümü</option>
              <option value="PENDING">Bekliyor</option>
              <option value="RECEIVED">Hesaba Yattı</option>
              <option value="CANCELLED">İptal</option>
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}><div className="spinner" /></div>
          ) : incomes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-text-muted)" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>💸</div>
              {statusFilter ? (lang === "en" ? "No records for this filter." : "Bu filtreye ait kayıt yok.") : (lang === "en" ? "No platform income added yet." : "Henüz platform geliri eklenmemiş.")}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table" style={{ width: "100%", fontSize: "14px" }}>
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Giriş Tarihi</th>
                    <th style={{ textAlign: "right" }}>Tutar</th>
                    <th>Yatacak Tarih</th>
                    <th>Durum</th>
                    <th style={{ textAlign: "center" }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.map(inc => {
                    const st = STATUS_MAP[inc.status];
                    const isOverdue = inc.status === "PENDING" && new Date(inc.expectedPaymentDate) < new Date();
                    return (
                      <tr key={inc.id}>
                        <td style={{ fontWeight: 600 }}>{inc.platformName}</td>
                        <td style={{ color: "var(--color-text-muted)" }}>
                          {format(new Date(inc.incomeDate), "dd MMM yyyy", { locale: tr })}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(Number(inc.amount))}</td>
                        <td>
                          <span style={{ color: isOverdue ? "var(--color-danger)" : "var(--color-text)", fontWeight: isOverdue ? 700 : 400 }}>
                            {format(new Date(inc.expectedPaymentDate), "dd MMM yyyy", { locale: tr })}
                          </span>
                          {isOverdue && <span style={{ marginLeft: "6px", fontSize: "11px", color: "var(--color-danger)" }}>❗</span>}
                        </td>
                        <td>
                          <select
                            value={inc.status}
                            onChange={e => handleStatusChange(inc.id, e.target.value)}
                            style={{
                              padding: "3px 8px",
                              borderRadius: "var(--radius-sm)",
                              fontSize: "12px",
                              fontWeight: 600,
                              background: st.bg,
                              color: st.color,
                              border: `1px solid ${st.color}40`,
                              cursor: "pointer",
                            }}
                          >
                            <option value="PENDING">Bekliyor</option>
                            <option value="RECEIVED">Hesaba Yattı</option>
                            <option value="CANCELLED">İptal</option>
                          </select>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                            <button
                              onClick={() => openEdit(inc)}
                              style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer", fontSize: "12px", color: "var(--color-text)" }}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => setDeleteId(inc.id)}
                              style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-danger)", background: "transparent", cursor: "pointer", fontSize: "12px", color: "var(--color-danger)" }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* EDIT MODAL */}
      {editRecord && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "460px", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>
              Platform Gelirini Düzenle
            </h3>
            <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Platform Name" : "Platform Adı"}</label>
                <input list="platform-suggestions-edit" className="form-input" name="platformName" value={editForm.platformName} onChange={handleEditChange} required />
                <datalist id="platform-suggestions-edit">
                  {PLATFORM_SUGGESTIONS.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Tutar (₺)</label>
                <input type="number" step="0.01" min="0.01" className="form-input" name="amount" value={editForm.amount} onChange={handleEditChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Giriş Tarihi</label>
                <input type="date" className="form-input" name="incomeDate" value={editForm.incomeDate} onChange={handleEditChange} required />
              </div>
              <div style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)", fontSize: "13px" }}>
                ⏳ Yeni Ödeme Tarihi: <strong style={{ color: "#7c3aed" }}>{editPreviewDate}</strong>
              </div>
              <div className="form-group">
                <label className="form-label">Notlar</label>
                <textarea className="form-input" name="notes" value={editForm.notes} onChange={handleEditChange} rows={2} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <button type="button" className="btn" onClick={() => setEditRecord(null)} style={{ border: "1px solid var(--color-border)" }}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? "Güncelleniyor..." : "Güncelle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "380px" }}>
            <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "12px" }}>Silmeyi Onayla</h3>
            <p style={{ color: "var(--color-text-muted)", fontSize: "14px", marginBottom: "24px" }}>
              Bu platform geliri silinecek. Bu işlem geri alınamaz.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <button className="btn" onClick={() => setDeleteId(null)} style={{ border: "1px solid var(--color-border)" }}>İptal</button>
              <button className="btn" onClick={handleDelete} disabled={deleteSubmitting}
                style={{ background: "var(--color-danger)", color: "white", border: "none" }}>
                {deleteSubmitting ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
