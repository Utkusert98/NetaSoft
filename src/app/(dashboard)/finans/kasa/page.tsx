"use client";
import { useLangContext } from "@/app/providers/LangProvider";
import { t, tx } from "@/lib/i18n/translations";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "CHF", "SAR", "JPY"];

type Register = {
  id: string;
  registerDate: string;
  posAmount: number;
  cashAmount: number;
  wireAmount: number;
  foreignCurrencyAmount: number;
  foreignCurrencyType: string;
  notes?: string;
};

const emptyForm = {
  registerDate: new Date().toISOString().split("T")[0],
  posAmount: "",
  cashAmount: "",
  wireAmount: "",
  foreignCurrencyAmount: "",
  foreignCurrencyType: "USD",
  notes: "",
};

export default function KasaPage() {
  const { lang } = useLangContext();
  const [records, setRecords] = useState<Register[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(emptyForm);

  // Edit modal state
  const [editRecord, setEditRecord] = useState<Register | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete confirm state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/finans/kasa");
      const json = await res.json();
      if (json.success) setRecords(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const calcTotal = (d: typeof emptyForm | Register) =>
    [
      Number(d.posAmount) || 0,
      Number(d.cashAmount) || 0,
      Number(d.wireAmount) || 0,
    ].reduce((a, b) => a + b, 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        ...formData,
        posAmount: parseFloat(formData.posAmount || "0"),
        cashAmount: parseFloat(formData.cashAmount || "0"),
        wireAmount: parseFloat(formData.wireAmount || "0"),
        foreignCurrencyAmount: parseFloat(formData.foreignCurrencyAmount || "0"),
      };
      const res = await fetch("/api/v1/finans/kasa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Bir hata oluştu");
      setFormData(emptyForm);
      await fetchRecords();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (rec: Register) => {
    setEditRecord(rec);
    setEditForm({
      registerDate: new Date(rec.registerDate).toISOString().split("T")[0],
      posAmount: String(rec.posAmount),
      cashAmount: String(rec.cashAmount),
      wireAmount: String(rec.wireAmount),
      foreignCurrencyAmount: String(rec.foreignCurrencyAmount),
      foreignCurrencyType: rec.foreignCurrencyType,
      notes: rec.notes || "",
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
      const payload = {
        ...editForm,
        posAmount: parseFloat(editForm.posAmount || "0"),
        cashAmount: parseFloat(editForm.cashAmount || "0"),
        wireAmount: parseFloat(editForm.wireAmount || "0"),
        foreignCurrencyAmount: parseFloat(editForm.foreignCurrencyAmount || "0"),
      };
      const res = await fetch(`/api/v1/finans/kasa/${editRecord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Bir hata oluştu");
      setEditRecord(null);
      await fetchRecords();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/v1/finans/kasa/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silme işlemi başarısız");
      setDeleteId(null);
      await fetchRecords();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const fmt = (v: number) => Number(v).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });

  return (
    <div style={{ padding: "var(--spacing-8)", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "var(--spacing-6)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700 }}>{tx(t.kasa.title, lang)}</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "14px", marginTop: "4px" }}>
          Günlük POS, nakit, havale ve döviz tahsilatlarını kayıt altına alın.
        </p>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "24px", fontSize: "14px" }}>
          {error}
          <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "var(--spacing-8)", alignItems: "start" }}>
        {/* FORM */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-5)" }}>
            📅 Yeni Kasa Girişi
          </h2>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <div className="form-group">
              <label className="form-label">Tarih</label>
              <input type="date" className="form-input" name="registerDate" value={formData.registerDate} onChange={handleChange} required />
            </div>

            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "16px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Tahsilat Kanalları (₺)
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { name: "posAmount", label: "💳 POS" },
                  { name: "cashAmount", label: "💵 Nakit" },
                  { name: "wireAmount", label: "🏦 Havale / EFT" },
                ].map(field => (
                  <div key={field.name} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px", alignItems: "center" }}>
                    <label style={{ fontSize: "13px", fontWeight: 500 }}>{field.label}</label>
                    <input
                      type="number" step="0.01" min="0"
                      className="form-input"
                      name={field.name}
                      value={(formData as any)[field.name]}
                      onChange={handleChange}
                      placeholder="0,00"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "16px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Döviz Tahsilatı
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: "8px" }}>
                <input
                  type="number" step="0.01" min="0"
                  className="form-input"
                  name="foreignCurrencyAmount"
                  value={formData.foreignCurrencyAmount}
                  onChange={handleChange}
                  placeholder="Tutar"
                />
                <select className="form-input" name="foreignCurrencyType" value={formData.foreignCurrencyType} onChange={handleChange}>
                  {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Toplam */}
            <div style={{
              padding: "14px 16px",
              background: "var(--color-primary-light)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid var(--color-primary)",
              
            }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-primary)" }}>Toplam (TL)</span>
              <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-primary)" }}>
                {calcTotal(formData).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Notlar</label>
              <textarea className="form-input" name="notes" value={formData.notes} onChange={handleChange} rows={2} placeholder="İsteğe bağlı..." />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? (lang === "en" ? "Saving..." : "Kaydediliyor...") : (lang === "en" ? "✓ Close Register" : "✓ Kasayı Kapat")}
            </button>
          </form>
        </div>

        {/* TABLE */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-4)" }}>
            <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600 }}>
              Kasa Kayıtları
            </h2>
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}><div className="spinner" /></div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-text-muted)" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🏦</div>
              {lang === "en" ? "No cash records added yet." : "Henüz kasa kaydı eklenmemiş."}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table" style={{ width: "100%", fontSize: "14px" }}>
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th style={{ textAlign: "right" }}>{lang === "en" ? "POS" : "POS"}</th>
                    <th style={{ textAlign: "right" }}>Nakit</th>
                    <th style={{ textAlign: "right" }}>Havale</th>
                    <th style={{ textAlign: "right" }}>Döviz</th>
                    <th style={{ textAlign: "right" }}>Toplam</th>
                    <th style={{ textAlign: "center" }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(rec => {
                    const total = Number(rec.posAmount) + Number(rec.cashAmount) + Number(rec.wireAmount);
                    return (
                      <tr key={rec.id}>
                        <td style={{ fontWeight: 600 }}>
                          {format(new Date(rec.registerDate), "dd MMM yyyy", { locale: tr })}
                        </td>
                        <td style={{ textAlign: "right" }}>{fmt(Number(rec.posAmount))}</td>
                        <td style={{ textAlign: "right" }}>{fmt(Number(rec.cashAmount))}</td>
                        <td style={{ textAlign: "right" }}>{fmt(Number(rec.wireAmount))}</td>
                        <td style={{ textAlign: "right", color: "var(--color-text-muted)", fontSize: "13px" }}>
                          {Number(rec.foreignCurrencyAmount) > 0
                            ? `${Number(rec.foreignCurrencyAmount).toLocaleString("tr-TR")} ${rec.foreignCurrencyType}`
                            : "—"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-primary)" }}>
                          {fmt(total)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                            <button
                              onClick={() => openEdit(rec)}
                              style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer", fontSize: "12px", color: "var(--color-text)" }}
                            >
                              ✏️ Düzenle
                            </button>
                            <button
                              onClick={() => setDeleteId(rec.id)}
                              style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-danger)", background: "transparent", cursor: "pointer", fontSize: "12px", color: "var(--color-danger)" }}
                            >
                              🗑️ Sil
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
              Kasa Kaydını Düzenle
            </h3>
            <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
              <div className="form-group">
                <label className="form-label">Tarih</label>
                <input type="date" className="form-input" name="registerDate" value={editForm.registerDate} onChange={handleEditChange} required />
              </div>
              {[
                { name: "posAmount", label: lang === "en" ? "POS (₺)" : "POS (₺)" },
                { name: "cashAmount", label: lang === "en" ? "Cash (₺)" : "Nakit (₺)" },
                { name: "wireAmount", label: lang === "en" ? "Wire / EFT (₺)" : "Havale / EFT (₺)" },
              ].map(field => (
                <div key={field.name} className="form-group">
                  <label className="form-label">{field.label}</label>
                  <input type="number" step="0.01" min="0" className="form-input" name={field.name} value={(editForm as any)[field.name]} onChange={handleEditChange} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Döviz Tutarı</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: "8px" }}>
                  <input type="number" step="0.01" min="0" className="form-input" name="foreignCurrencyAmount" value={editForm.foreignCurrencyAmount} onChange={handleEditChange} />
                  <select className="form-input" name="foreignCurrencyType" value={editForm.foreignCurrencyType} onChange={handleEditChange}>
                    {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notlar</label>
                <textarea className="form-input" name="notes" value={editForm.notes} onChange={handleEditChange} rows={2} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <button type="button" className="btn" onClick={() => setEditRecord(null)} style={{ border: "1px solid var(--color-border)" }}>
                  İptal
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? (lang === "en" ? "Saving..." : "Kaydediliyor...") : (lang === "en" ? "Update" : "Güncelle")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "380px" }}>
            <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "12px" }}>Silmeyi Onayla</h3>
            <p style={{ color: "var(--color-text-muted)", fontSize: "14px", marginBottom: "24px" }}>
              Bu kasa kapatma kaydı silinecek. Bu işlem geri alınamaz.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <button className="btn" onClick={() => setDeleteId(null)} style={{ border: "1px solid var(--color-border)" }}>İptal</button>
              <button
                className="btn"
                onClick={handleDelete}
                disabled={deleteSubmitting}
                style={{ background: "var(--color-danger)", color: "white", border: "none" }}
              >
                {deleteSubmitting ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
