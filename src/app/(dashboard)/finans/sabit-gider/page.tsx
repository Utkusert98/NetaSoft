"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default function SabitGiderPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    type: "INVOICE",
    customType: "",
    amount: "",
    expenseDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const res = await fetch("/api/v1/finans/sabit-gider");
      const json = await res.json();
      if (json.success) setExpenses(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
        amount: parseFloat(formData.amount),
        expenseDate: formData.expenseDate + "T00:00:00.000Z"
      };

      const res = await fetch("/api/v1/finans/sabit-gider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Bir hata oluştu");

      setFormData({
        type: "INVOICE",
        customType: "",
        amount: "",
        expenseDate: new Date().toISOString().split("T")[0],
        notes: "",
      });
      
      fetchExpenses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/v1/finans/sabit-gider/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      await fetchExpenses();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const getTypeLabel = (type: string, customType?: string) => {
    switch (type) {
      case "INVOICE": return "Fatura";
      case "ACCOUNTING": return "Muhasebe";
      case "TAX": return "Vergi";
      case "RENT": return "Kira";
      case "OTHER": return customType || "Diğer";
      default: return type;
    }
  };

  return (
    <div style={{ padding: "var(--spacing-8)", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700, marginBottom: "var(--spacing-6)" }}>Sabit Giderler</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "var(--spacing-8)", alignItems: "start" }}>
        {/* Form Card */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>Yeni Gider Ekle</h2>
          
          {error && (
            <div style={{ padding: "12px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "16px", fontSize: "14px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <div className="form-group">
              <label className="form-label">Gider Türü</label>
              <select className="form-input" name="type" value={formData.type} onChange={handleChange} required>
                <option value="INVOICE">Fatura</option>
                <option value="ACCOUNTING">Muhasebe</option>
                <option value="TAX">Vergi</option>
                <option value="RENT">Kira</option>
                <option value="OTHER">Diğer</option>
              </select>
            </div>

            {formData.type === "OTHER" && (
              <div className="form-group">
                <label className="form-label">Özel Gider Türü</label>
                <input type="text" className="form-input" name="customType" value={formData.customType} onChange={handleChange} required />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Tutar (₺)</label>
              <input type="number" step="0.01" className="form-input" name="amount" value={formData.amount} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">Gider Tarihi</label>
              <input type="date" className="form-input" name="expenseDate" value={formData.expenseDate} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">Notlar</label>
              <textarea className="form-input" name="notes" value={formData.notes} onChange={handleChange} rows={2} />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? "Kaydediliyor..." : "Gider Kaydet"}
            </button>
          </form>
        </div>

        {/* Table Card */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>Geçmiş Giderler</h2>
          
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /></div>
          ) : expenses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--color-text-muted)" }}>Henüz Gider Eklenmemiş.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: "14px" }}>
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Tür</th>
                    <th>Tutar</th>
                    <th>Notlar</th>
                    <th style={{ textAlign: "right" }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td>{format(new Date(exp.expenseDate), "dd MMM yyyy", { locale: tr })}</td>
                      <td>
                        <span style={{ padding: "4px 8px", background: "var(--color-bg)", borderRadius: "4px", fontSize: "12px", fontWeight: 500 }}>
                          {getTypeLabel(exp.type, exp.customType)}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{Number(exp.amount).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</td>
                      <td style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>{exp.notes || "-"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          onClick={() => setDeleteId(exp.id)}
                          style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "380px", padding: "var(--spacing-6)", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🗑️</div>
            <h3 style={{ fontWeight: 700, marginBottom: "8px" }}>Gideri Sil</h3>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--spacing-5)", fontSize: "14px" }}>
              Bu gider kaydını silmek istediğinizden emin misiniz?
            </p>
            <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setDeleteId(null)}>İptal</button>
              <button className="btn" style={{ flex: 1, background: "var(--color-danger)", color: "white" }} onClick={() => void handleDelete()} disabled={deleting}>
                {deleting ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
