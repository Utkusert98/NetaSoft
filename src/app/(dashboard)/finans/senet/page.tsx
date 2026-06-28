"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default function SenetPage() {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({
    noteNumber: "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date().toISOString().split("T")[0],
    amount: "",
    notes: "",
    isInstallment: false,
    installmentCount: 3,
  });

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await fetch("/api/v1/finans/senet");
      const json = await res.json();
      if (json.success) setNotes(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const payload = {
        ...formData,
        issueDate: new Date(formData.issueDate).toISOString(),
        dueDate: new Date(formData.dueDate).toISOString(),
        amount: parseFloat(formData.amount),
        installmentCount: formData.isInstallment ? parseInt(formData.installmentCount.toString()) : undefined
      };

      const res = await fetch("/api/v1/finans/senet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Bir hata oluştu");
      }

      // Reset form
      setFormData({
        noteNumber: "",
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: new Date().toISOString().split("T")[0],
        amount: "",
        notes: "",
        isInstallment: false,
        installmentCount: 3,
      });
      
      fetchNotes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "var(--spacing-8)", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700, marginBottom: "var(--spacing-6)" }}>Senet Girişi</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "var(--spacing-8)", alignItems: "start" }}>
        {/* Form Card */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>Yeni Senet Ekle</h2>
          
          {error && (
            <div style={{ padding: "12px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "16px", fontSize: "14px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <div className="form-group">
              <label className="form-label">Senet No</label>
              <input type="text" className="form-input" name="noteNumber" value={formData.noteNumber} onChange={handleChange} required />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-4)" }}>
              <div className="form-group">
                <label className="form-label">Senet Tarihi</label>
                <input type="date" className="form-input" name="issueDate" value={formData.issueDate} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">İlk Vade Tarihi</label>
                <input type="date" className="form-input" name="dueDate" value={formData.dueDate} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tutar (₺)</label>
              <input type="number" step="0.01" className="form-input" name="amount" value={formData.amount} onChange={handleChange} required />
            </div>

            <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
              <input type="checkbox" id="isInstallment" name="isInstallment" checked={formData.isInstallment} onChange={handleChange} style={{ width: "16px", height: "16px" }} />
              <label htmlFor="isInstallment" style={{ fontWeight: 500, fontSize: "14px", cursor: "pointer" }}>Taksit Var Mı?</label>
            </div>

            {formData.isInstallment && (
              <div className="form-group" style={{ padding: "12px", background: "var(--color-bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                <label className="form-label">Taksit Sayısı</label>
                <input type="number" min="2" max="120" className="form-input" name="installmentCount" value={formData.installmentCount} onChange={handleChange} required />
                <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "8px" }}>
                  Girilen {formData.amount || "0"} ₺ tutar, {formData.installmentCount} aya bölünerek ayrı senet kayıtları oluşturulacaktır.
                </p>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Notlar</label>
              <textarea className="form-input" name="notes" value={formData.notes} onChange={handleChange} rows={2} />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? "Kaydediliyor..." : "Senet Kaydet"}
            </button>
          </form>
        </div>

        {/* Table Card */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>Kayıtlı Senetler</h2>
          
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /></div>
          ) : notes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--color-text-muted)" }}>Henüz Senet Eklenmemiş.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: "14px" }}>
                <thead>
                  <tr>
                    <th>Vade Tarihi</th>
                    <th>Senet No</th>
                    <th>Tutar</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((note) => {
                    const isOverdue = new Date(note.dueDate) < new Date() && !note.isPaid;
                    return (
                      <tr key={note.id}>
                        <td style={{ color: isOverdue ? "var(--color-danger)" : "inherit", fontWeight: isOverdue ? 600 : 400 }}>
                          {format(new Date(note.dueDate), "dd MMM yyyy", { locale: tr })}
                        </td>
                        <td>
                          {note.noteNumber}
                          {note.installmentGroupId && (
                            <span style={{ marginLeft: "6px", fontSize: "11px", padding: "2px 6px", background: "var(--color-bg)", borderRadius: "4px" }}>
                              {note.installmentNumber}. Taksit
                            </span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>{Number(note.amount).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</td>
                        <td>
                          {note.isPaid ? (
                            <span style={{ color: "var(--color-success)", fontWeight: 500 }}>Ödendi</span>
                          ) : (
                            <span style={{ color: "var(--color-warning)", fontWeight: 500 }}>Bekliyor</span>
                          )}
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
    </div>
  );
}
