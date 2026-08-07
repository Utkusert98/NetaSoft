"use client";
import { useLangContext } from "@/app/providers/LangProvider";
import { t, tx } from "@/lib/i18n/translations";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { tr as trLocale, enUS } from "date-fns/locale";

interface PromissoryNote {
  id: string;
  noteNumber: string;
  supplierName?: string;
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
  supplierName: "",
  issueDate: new Date().toISOString().split("T")[0],
  dueDate: new Date().toISOString().split("T")[0],
  amount: "",
  notes: "",
  isInstallment: false,
  installmentCount: 3,
};

export default function SenetPage() {
  const { lang } = useLangContext();
  const locale = lang === "en" ? enUS : trLocale;
  const [notes, setNotes] = useState<PromissoryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [editNote, setEditNote] = useState<PromissoryNote | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", dueDate: "", notes: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchNotes(); }, []);

  const fetchNotes = async () => {
    try {
      const res = await fetch("/api/v1/finans/senet", { headers: { "Accept-Language": lang } });
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
        issueDate: formData.issueDate + "T00:00:00.000Z",
        dueDate: formData.dueDate + "T00:00:00.000Z",
        amount: parseFloat(formData.amount),
        installmentCount: formData.isInstallment ? parseInt(String(formData.installmentCount)) : undefined,
      };
      const res = await fetch("/api/v1/finans/senet", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
      setFormData(EMPTY_FORM);
      await fetchNotes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
    } finally {
      setSubmitting(false);
    }
  };

  const [paidError, setPaidError] = useState("");
  const [markingId, setMarkingId] = useState<string | null>(null);

  const handleMarkPaid = async (id: string, isPaid: boolean) => {
    setMarkingId(id);
    setPaidError("");
    setNotes(prev => prev.map(n => n.id === id ? { ...n, isPaid } : n));
    try {
      const res = await fetch(`/api/v1/finans/senet/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({ isPaid }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setNotes(prev => prev.map(n => n.id === id ? { ...n, isPaid: !isPaid } : n));
        setPaidError(json.error ?? (lang === "en" ? "Operation failed. Please try again." : "İşlem başarısız oldu. Lütfen tekrar deneyin."));
      } else {
        await fetchNotes();
      }
    } catch {
      setNotes(prev => prev.map(n => n.id === id ? { ...n, isPaid: !isPaid } : n));
      setPaidError(lang === "en" ? "Connection error. Please try again." : "Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setMarkingId(null);
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
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({
          amount: parseFloat(editForm.amount),
          dueDate: editForm.dueDate + "T00:00:00.000Z",
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
      await fetch(`/api/v1/finans/senet/${deleteId}`, { method: "DELETE", headers: { "Accept-Language": lang } });
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "var(--spacing-6)" }}>
        <div>
          <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700 }}>{tx(t.senet.title, lang)}</h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: "4px" }}>
            {lang === "en" ? "Note entry, tracking, payment marking" : "Senet girişi, takibi, ödeme işaretleme"}
          </p>
        </div>
        <a href="/finans/depo-havalesi"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontWeight: 600, fontSize: "14px", textDecoration: "none" }}>
          🏦 {lang === "en" ? "Supplier Transfer / EFT" : "Depo Havalesi / EFT"}
        </a>
      </div>

      {/* Özet kartları */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }}>
        {[
          { label: lang === "en" ? "Total Notes" : "Toplam Senet", value: notes.length, color: "var(--color-text)" },
          { label: lang === "en" ? "Pending Notes" : "Bekleyen Senet", value: unpaid.length, color: "var(--color-warning)" },
          { label: lang === "en" ? "Pending Amount" : "Bekleyen Tutar", value: totalUnpaid.toLocaleString("tr-TR", { style: "currency", currency: "TRY" }), color: "var(--color-danger)" },
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
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-5)" }}>
            {lang === "en" ? "Add New Note" : "Yeni Senet Ekle"}
          </h2>

          {error && (
            <div style={{ padding: "12px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "16px", fontSize: "14px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <div className="form-group">
              <label className="form-label required">{lang === "en" ? "Note Number" : "Senet No"}</label>
              <input type="text" className="form-input" name="noteNumber" value={formData.noteNumber} onChange={handleChange} required placeholder="SN-2024-001" />
            </div>

            <div className="form-group">
              <label className="form-label">{lang === "en" ? "Supplier / Creditor Name" : "Depo Adı / Alacaklı"}</label>
              <input type="text" className="form-input" name="supplierName" value={formData.supplierName} onChange={handleChange} placeholder={lang === "en" ? "Bağfaş, Hedef Ecza, etc." : "Bağfaş, Hedef Ecza vb."} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-3)" }}>
              <div className="form-group">
                <label className="form-label required">{lang === "en" ? "Issue Date" : "Senet Tarihi"}</label>
                <input type="date" className="form-input" name="issueDate" value={formData.issueDate} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label required">{lang === "en" ? "First Due Date" : "İlk Vade Tarihi"}</label>
                <input type="date" className="form-input" name="dueDate" value={formData.dueDate} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required">{lang === "en" ? "Total Amount (₺)" : "Toplam Tutar (₺)"}</label>
              <input type="number" step="0.01" min="0.01" className="form-input" name="amount" value={formData.amount} onChange={handleChange} required placeholder="0,00" />
            </div>

            <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", background: formData.isInstallment ? "var(--color-primary-pale)" : "var(--color-surface)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>{lang === "en" ? "Installment Note" : "Taksitli Senet"}</div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                    {lang === "en" ? "Split amount into monthly installments" : "Tutarı belirtilen aylara böl"}
                  </div>
                </div>
                <input type="checkbox" name="isInstallment" checked={formData.isInstallment} onChange={handleChange} style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)", cursor: "pointer" }} />
              </label>

              {formData.isInstallment && (
                <div style={{ padding: "16px", borderTop: "1px solid var(--color-border)", background: "var(--color-bg)" }}>
                  <div className="form-group" style={{ marginBottom: "8px" }}>
                    <label className="form-label">{lang === "en" ? "Installment Count (min. 2)" : "Taksit Sayısı (min. 2)"}</label>
                    <input type="number" min="2" max="120" className="form-input" name="installmentCount" value={formData.installmentCount} onChange={handleChange} required />
                  </div>
                  {formData.amount && Number(formData.amount) > 0 && (
                    <div style={{ padding: "10px 12px", background: "var(--color-primary-pale)", borderRadius: "var(--radius-sm)", fontSize: "13px", color: "var(--color-primary)", fontWeight: 500 }}>
                      {lang === "en" ? "Monthly installment:" : "Aylık taksit:"} {(Number(formData.amount) / formData.installmentCount).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">{lang === "en" ? "Notes" : "Notlar"}</label>
              <textarea className="form-input" name="notes" value={formData.notes} onChange={handleChange} rows={2} placeholder={lang === "en" ? "Description (optional)" : "Açıklama (isteğe bağlı)"} />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting
                ? (lang === "en" ? "Saving..." : "Kaydediliyor...")
                : formData.isInstallment
                  ? (lang === "en" ? `Create ${formData.installmentCount} Installments` : `${formData.installmentCount} Taksit Senet Oluştur`)
                  : (lang === "en" ? "Save Note" : "Senet Kaydet")}
            </button>
          </form>
        </div>

        {/* ── Tablo ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-5)" }}>

          {/* Bekleyen senetler */}
          <div className="card">
            <h2 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, marginBottom: "var(--spacing-4)", color: "var(--color-warning)" }}>
              {lang === "en" ? `Pending Notes (${unpaid.length})` : `Bekleyen Senetler (${unpaid.length})`}
            </h2>
            {paidError && (
              <div style={{ marginBottom: "var(--spacing-3)", padding: "10px 14px", background: "var(--color-danger-pale, #fee2e2)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", fontSize: "13px", fontWeight: 500 }}>
                ⚠ {paidError}
              </div>
            )}
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /></div>
            ) : unpaid.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "var(--color-text-muted)", fontSize: "14px" }}>
                {lang === "en" ? "No pending notes." : "Bekleyen senet yok."}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th>{lang === "en" ? "Note No" : "Senet No"}</th>
                      <th>{lang === "en" ? "Due Date" : "Vade Tarihi"}</th>
                      <th>{lang === "en" ? "Amount" : "Tutar"}</th>
                      <th>{lang === "en" ? "Notes" : "Notlar"}</th>
                      <th style={{ textAlign: "right" }}>{lang === "en" ? "Actions" : "İşlem"}</th>
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
                                {lang === "en" ? `${note.installmentNumber ?? ""}. installment` : `${note.installmentNumber}. taksit`}
                              </span>
                            )}
                          </td>
                          <td style={{ color: isOverdue ? "var(--color-danger)" : "inherit", fontWeight: isOverdue ? 600 : 400 }}>
                            {format(new Date(note.dueDate), "dd MMM yyyy", { locale })}
                            {isOverdue && <span style={{ marginLeft: "4px", fontSize: "11px" }}>⚠ {lang === "en" ? "Overdue" : "Vadesi Geçti"}</span>}
                          </td>
                          <td style={{ fontWeight: 700, color: "var(--color-danger)" }}>
                            {Number(note.amount).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                          </td>
                          <td style={{ color: "var(--color-text-muted)", fontSize: "12px", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {note.notes || "—"}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                              <button onClick={() => void handleMarkPaid(note.id, true)} disabled={markingId === note.id}
                                style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-success)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: markingId === note.id ? "not-allowed" : "pointer", fontWeight: 600, opacity: markingId === note.id ? 0.7 : 1 }}>
                                {markingId === note.id ? "..." : lang === "en" ? "Paid" : "Ödendi"}
                              </button>
                              <button onClick={() => openEdit(note)}
                                style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-primary)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", fontWeight: 500 }}>
                                {lang === "en" ? "Edit" : "Düzenle"}
                              </button>
                              <button onClick={() => setDeleteId(note.id)}
                                style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                                {lang === "en" ? "Delete" : "Sil"}
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
                {lang === "en" ? `Paid Notes (${paid.length})` : `Ödenen Senetler (${paid.length})`}
              </h2>
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th>{lang === "en" ? "Note No" : "Senet No"}</th>
                      <th>{lang === "en" ? "Due Date" : "Vade Tarihi"}</th>
                      <th>{lang === "en" ? "Amount" : "Tutar"}</th>
                      <th>{lang === "en" ? "Payment Date" : "Ödeme Tarihi"}</th>
                      <th style={{ textAlign: "right" }}>{lang === "en" ? "Actions" : "İşlem"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paid.map(note => (
                      <tr key={note.id} style={{ opacity: 0.7 }}>
                        <td style={{ fontWeight: 600 }}>{note.noteNumber}</td>
                        <td>{format(new Date(note.dueDate), "dd MMM yyyy", { locale })}</td>
                        <td style={{ fontWeight: 700 }}>
                          {Number(note.amount).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                        </td>
                        <td style={{ color: "var(--color-success)", fontSize: "12px" }}>
                          {note.paidDate ? format(new Date(note.paidDate), "dd MMM yyyy", { locale }) : "—"}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                            <button onClick={() => void handleMarkPaid(note.id, false)} disabled={markingId === note.id}
                              style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-warning)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: markingId === note.id ? "not-allowed" : "pointer", opacity: markingId === note.id ? 0.7 : 1 }}>
                              {markingId === note.id ? "..." : lang === "en" ? "Mark Unpaid" : "Ödenmedi"}
                            </button>
                            <button onClick={() => setDeleteId(note.id)}
                              style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                              {lang === "en" ? "Delete" : "Sil"}
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

      {/* Edit Modal */}
      {editNote && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "460px", padding: "var(--spacing-6)" }}>
            <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "var(--spacing-5)" }}>
              {lang === "en" ? "Edit Note" : "Senet Düzenle"}
            </h3>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "var(--spacing-4)" }}>
              {lang === "en" ? "Note No:" : "Senet No:"} <strong>{editNote.noteNumber}</strong>
            </p>
            <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Amount (₺)" : "Tutar (₺)"}</label>
                <input type="number" step="0.01" className="form-input" value={editForm.amount} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Due Date" : "Vade Tarihi"}</label>
                <input type="date" className="form-input" value={editForm.dueDate} onChange={e => setEditForm(p => ({ ...p, dueDate: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Notes" : "Notlar"}</label>
                <textarea className="form-input" value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>
              <div style={{ display: "flex", gap: "var(--spacing-3)", marginTop: "var(--spacing-2)" }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setEditNote(null)}>
                  {lang === "en" ? "Cancel" : "İptal"}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={editSubmitting}>
                  {editSubmitting ? (lang === "en" ? "Saving..." : "Kaydediliyor...") : (lang === "en" ? "Save" : "Kaydet")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "400px", padding: "var(--spacing-6)", textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🗑️</div>
            <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "8px" }}>
              {lang === "en" ? "Delete Note" : "Senedi Sil"}
            </h3>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--spacing-5)", fontSize: "14px" }}>
              {lang === "en" ? "Are you sure you want to delete this note? This action cannot be undone." : "Bu senedi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."}
            </p>
            <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setDeleteId(null)}>
                {lang === "en" ? "Cancel" : "İptal"}
              </button>
              <button className="btn" style={{ flex: 1, background: "var(--color-danger)", color: "white" }} onClick={() => void handleDelete()} disabled={deleting}>
                {deleting ? (lang === "en" ? "Deleting..." : "Siliniyor...") : (lang === "en" ? "Yes, Delete" : "Evet, Sil")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
