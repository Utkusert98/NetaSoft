"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface PromissoryNote {
  id: string;
  noteNumber: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  notes?: string;
  isPaid: boolean;
  paidDate?: string;
  installmentGroupId?: string;
  installmentNumber?: number;
  deletedAt?: string;
}

const EMPTY_FORM = {
  noteNumber: "",
  issueDate: new Date().toISOString().split("T")[0],
  dueDate: new Date().toISOString().split("T")[0],
  amount: "",
  notes: "",
  isInstallment: false,
  installmentCount: 3,
};

export default function SenetPage() {
  const [notes, setNotes] = useState<PromissoryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(EMPTY_FORM);

  // Edit modal
  const [editNote, setEditNote] = useState<PromissoryNote | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", dueDate: "", notes: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchNotes(); }, []);

  const fetchNotes = async () => {
    try {
      const res = await fetch("/api/v1/finans/senet");
      const json = await res.json() as { success: boolean; data?: PromissoryNote[] };
      if (json.success && json.data) setNotes(json.data);
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
        installmentCount: formData.isInstallment ? parseInt(String(formData.installmentCount)) : undefined,
      };
      const res = await fetch("/api/v1/finans/senet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || "Bir hata oluştu");
      setFormData(EMPTY_FORM);
      await fetchNotes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (id: string, isPaid: boolean) => {
    try {
      await fetch(`/api/v1/finans/senet/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid }),
      });
      await fetchNotes();
    } catch (e) {
      console.error(e);
    }
  };

  const openEdit = (note: PromissoryNote) => {
    setEditNote(note);
    setEditForm({
      amount: String(note.amount),
      dueDate: new Date(note.dueDate).toISOString().split("T")[0],
      notes: note.notes ?? "",
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNote) return;
    setEditSubmitting(true);
    try {
      await fetch(`/api/v1/finans/senet/${editNote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(editForm.amount),
          dueDate: new Date(editForm.dueDate).toISOString(),
          notes: editForm.notes,
        }),
      });
      setEditNote(null);
      await fetchNotes();
    } catch (e) {
      console.error(e);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/v1/finans/senet/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      await fetchNotes();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const unpaid = notes.filter(n => !n.isPaid);
  const paid = notes.filter(n => n.isPaid);
  const totalUnpaid = unpaid.reduce((s, n) => s + Number(n.amount), 0);

  return (
    <div style={{ padding: "var(--spacing-8)", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "var(--spacing-6)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700 }}>Senet Yönetimi</h1>
        <p style={{ color: "var(--color-text-muted)", marginTop: "4px" }}>Senet girişi, takibi, ödeme işaretleme</p>
      </div>

      {/* Özet kartları */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }}>
        {[
          { label: "Toplam Senet", value: notes.length, color: "var(--color-text)" },
          { label: "Bekleyen Senet", value: unpaid.length, color: "var(--color-warning)" },
          { label: "Bekleyen Tutar", value: totalUnpaid.toLocaleString("tr-TR", { style: "currency", currency: "TRY" }), color: "var(--color-danger)" },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: "var(--spacing-4)" }}>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>{c.label}</div>
            <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "var(--spacing-6)", alignItems: "start" }}>

        {/* ── Form ── */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-5)" }}>Yeni Senet Ekle</h2>

          {error && (
            <div style={{ padding: "12px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "16px", fontSize: "14px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <div className="form-group">
              <label className="form-label required">Senet No</label>
              <input type="text" className="form-input" name="noteNumber" value={formData.noteNumber} onChange={handleChange} required placeholder="SN-2024-001" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-3)" }}>
              <div className="form-group">
                <label className="form-label required">Senet Tarihi</label>
                <input type="date" className="form-input" name="issueDate" value={formData.issueDate} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label required">İlk Vade Tarihi</label>
                <input type="date" className="form-input" name="dueDate" value={formData.dueDate} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required">Toplam Tutar (₺)</label>
              <input type="number" step="0.01" min="0.01" className="form-input" name="amount" value={formData.amount} onChange={handleChange} required placeholder="0,00" />
            </div>

            {/* Taksit toggle */}
            <div style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}>
              <label style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                cursor: "pointer",
                background: formData.isInstallment ? "var(--color-primary-pale)" : "var(--color-surface)",
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>Taksitli Senet</div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Tutarı belirtilen aylara böl</div>
                </div>
                <input
                  type="checkbox"
                  name="isInstallment"
                  checked={formData.isInstallment}
                  onChange={handleChange}
                  style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)", cursor: "pointer" }}
                />
              </label>

              {formData.isInstallment && (
                <div style={{ padding: "16px", borderTop: "1px solid var(--color-border)", background: "var(--color-bg)" }}>
                  <div className="form-group" style={{ marginBottom: "8px" }}>
                    <label className="form-label">Taksit Sayısı (min. 2)</label>
                    <input
                      type="number"
                      min="2"
                      max="120"
                      className="form-input"
                      name="installmentCount"
                      value={formData.installmentCount}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  {formData.amount && Number(formData.amount) > 0 && (
                    <div style={{
                      padding: "10px 12px",
                      background: "var(--color-primary-pale)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "13px",
                      color: "var(--color-primary)",
                      fontWeight: 500,
                    }}>
                      Aylık taksit: {(Number(formData.amount) / formData.installmentCount).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Notlar</label>
              <textarea className="form-input" name="notes" value={formData.notes} onChange={handleChange} rows={2} placeholder="Açıklama (isteğe bağlı)" />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? "Kaydediliyor..." : formData.isInstallment ? `${formData.installmentCount} Taksit Senet Oluştur` : "Senet Kaydet"}
            </button>
          </form>
        </div>

        {/* ── Tablo ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-5)" }}>

          {/* Bekleyen senetler */}
          <div className="card">
            <h2 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, marginBottom: "var(--spacing-4)", color: "var(--color-warning)" }}>
              Bekleyen Senetler ({unpaid.length})
            </h2>
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /></div>
            ) : unpaid.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "var(--color-text-muted)", fontSize: "14px" }}>Bekleyen senet yok.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th>Senet No</th>
                      <th>Vade Tarihi</th>
                      <th>Tutar</th>
                      <th>Notlar</th>
                      <th style={{ textAlign: "right" }}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaid.map(note => {
                      const isOverdue = new Date(note.dueDate) < new Date();
                      return (
                        <tr key={note.id}>
                          <td>
                            <span style={{ fontWeight: 600 }}>{note.noteNumber}</span>
                            {note.installmentGroupId && (
                              <span style={{ marginLeft: "6px", fontSize: "11px", padding: "2px 6px", background: "var(--color-primary-pale)", color: "var(--color-primary)", borderRadius: "4px" }}>
                                {note.installmentNumber}. taksit
                              </span>
                            )}
                          </td>
                          <td style={{ color: isOverdue ? "var(--color-danger)" : "inherit", fontWeight: isOverdue ? 600 : 400 }}>
                            {format(new Date(note.dueDate), "dd MMM yyyy", { locale: tr })}
                            {isOverdue && <span style={{ marginLeft: "4px", fontSize: "11px" }}>⚠ Vadesi Geçti</span>}
                          </td>
                          <td style={{ fontWeight: 700, color: "var(--color-danger)" }}>
                            {Number(note.amount).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                          </td>
                          <td style={{ color: "var(--color-text-muted)", fontSize: "12px", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {note.notes || "—"}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                              <button
                                onClick={() => void handleMarkPaid(note.id, true)}
                                style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-success)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", fontWeight: 600 }}
                              >
                                Ödendi
                              </button>
                              <button
                                onClick={() => openEdit(note)}
                                style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-info, #3b82f6)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
                              >
                                Düzenle
                              </button>
                              <button
                                onClick={() => setDeleteId(note.id)}
                                style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
                              >
                                Sil
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

          {/* Ödenen senetler */}
          {paid.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, marginBottom: "var(--spacing-4)", color: "var(--color-success)" }}>
                Ödenen Senetler ({paid.length})
              </h2>
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th>Senet No</th>
                      <th>Vade Tarihi</th>
                      <th>Tutar</th>
                      <th>Ödeme Tarihi</th>
                      <th style={{ textAlign: "right" }}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paid.map(note => (
                      <tr key={note.id} style={{ opacity: 0.7 }}>
                        <td style={{ fontWeight: 600 }}>{note.noteNumber}</td>
                        <td>{format(new Date(note.dueDate), "dd MMM yyyy", { locale: tr })}</td>
                        <td style={{ fontWeight: 700 }}>
                          {Number(note.amount).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                        </td>
                        <td style={{ color: "var(--color-success)", fontSize: "12px" }}>
                          {note.paidDate ? format(new Date(note.paidDate), "dd MMM yyyy", { locale: tr }) : "—"}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => void handleMarkPaid(note.id, false)}
                              style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-warning)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
                            >
                              Ödenmedi
                            </button>
                            <button
                              onClick={() => setDeleteId(note.id)}
                              style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
                            >
                              Sil
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Düzenle Modal ── */}
      {editNote && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "460px", padding: "var(--spacing-6)" }}>
            <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "var(--spacing-5)" }}>Senet Düzenle</h3>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "var(--spacing-4)" }}>
              Senet No: <strong>{editNote.noteNumber}</strong>
            </p>
            <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
              <div className="form-group">
                <label className="form-label">Tutar (₺)</label>
                <input type="number" step="0.01" className="form-input" value={editForm.amount} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Vade Tarihi</label>
                <input type="date" className="form-input" value={editForm.dueDate} onChange={e => setEditForm(p => ({ ...p, dueDate: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Notlar</label>
                <textarea className="form-input" value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>
              <div style={{ display: "flex", gap: "var(--spacing-3)", marginTop: "var(--spacing-2)" }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setEditNote(null)}>İptal</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={editSubmitting}>
                  {editSubmitting ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Sil Onay Modal ── */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "400px", padding: "var(--spacing-6)", textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🗑️</div>
            <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "8px" }}>Senedi Sil</h3>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--spacing-5)", fontSize: "14px" }}>
              Bu senedi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
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
