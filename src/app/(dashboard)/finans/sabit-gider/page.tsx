"use client";
import { useLangContext } from "@/app/providers/LangProvider";
import { t, tx } from "@/lib/i18n/translations";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { tr as trLocale, enUS } from "date-fns/locale";

type Expense = {
  id: string;
  type: string;
  customType?: string;
  amount: number;
  expenseDate: string;
  notes?: string;
};

export default function SabitGiderPage() {
  const { lang } = useLangContext();
  const locale = lang === "en" ? enUS : trLocale;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState({ type: "INVOICE", customType: "", amount: "", expenseDate: "", notes: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [histStart, setHistStart] = useState("");
  const [histEnd, setHistEnd] = useState("");

  const [formData, setFormData] = useState({
    type: "INVOICE",
    customType: "",
    amount: "",
    expenseDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => { fetchExpenses(); }, []);

  const fetchExpenses = async () => {
    try {
      const res = await fetch("/api/v1/finans/sabit-gider", { headers: { "Accept-Language": lang } });
      const json = await res.json();
      if (json.success) setExpenses(json.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
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
      const payload = { ...formData, amount: parseFloat(formData.amount), expenseDate: formData.expenseDate + "T00:00:00.000Z" };
      const res = await fetch("/api/v1/finans/sabit-gider", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
      setFormData({ type: "INVOICE", customType: "", amount: "", expenseDate: new Date().toISOString().split("T")[0], notes: "" });
      fetchExpenses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/v1/finans/sabit-gider/${deleteId}`, { method: "DELETE", headers: { "Accept-Language": lang } });
      setDeleteId(null);
      await fetchExpenses();
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  };

  const openEdit = (exp: Expense) => {
    setEditExpense(exp);
    setEditForm({
      type: exp.type,
      customType: exp.customType ?? "",
      amount: String(exp.amount),
      expenseDate: new Date(exp.expenseDate).toISOString().split("T")[0],
      notes: exp.notes ?? "",
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExpense) return;
    setEditSubmitting(true);
    try {
      await fetch(`/api/v1/finans/sabit-gider/${editExpense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({
          type: editForm.type,
          customType: editForm.type === "OTHER" ? editForm.customType : undefined,
          amount: parseFloat(editForm.amount),
          expenseDate: editForm.expenseDate + "T00:00:00.000Z",
          notes: editForm.notes,
        }),
      });
      setEditExpense(null);
      await fetchExpenses();
    } catch (e) { console.error(e); }
    finally { setEditSubmitting(false); }
  };

  const getTypeLabel = (type: string, customType?: string) => {
    const labels: Record<string, { tr: string; en: string }> = {
      INVOICE: { tr: "Fatura", en: "Invoice" },
      ACCOUNTING: { tr: "Muhasebe", en: "Accounting" },
      TAX: { tr: "Vergi", en: "Tax" },
      RENT: { tr: "Kira", en: "Rent" },
      OTHER: { tr: customType || "Diğer", en: customType || "Other" },
    };
    return labels[type]?.[lang] ?? type;
  };

  const fmt = (v: number) => Number(v).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });

  const nowM = new Date();
  const thisMonthExpenses = expenses.filter(exp => {
    const d = new Date(exp.expenseDate);
    return d.getMonth() === nowM.getMonth() && d.getFullYear() === nowM.getFullYear();
  });
  const historyExpenses = expenses.filter(exp => {
    const d = exp.expenseDate.substring(0, 10);
    if (histStart && d < histStart) return false;
    if (histEnd && d > histEnd) return false;
    return true;
  });
  const thisMonthTotal = thisMonthExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  const expenseTableHeader = (
    <thead>
      <tr>
        <th>{lang === "en" ? "Date" : "Tarih"}</th>
        <th>{lang === "en" ? "Type" : "Tür"}</th>
        <th>{lang === "en" ? "Amount" : "Tutar"}</th>
        <th>{lang === "en" ? "Notes" : "Notlar"}</th>
        <th style={{ textAlign: "right" }}>{lang === "en" ? "Actions" : "İşlem"}</th>
      </tr>
    </thead>
  );

  const renderExpenseRows = (rows: Expense[]) =>
    rows.map(exp => (
      <tr key={exp.id}>
        <td>{format(new Date(exp.expenseDate), "dd MMM yyyy", { locale })}</td>
        <td>
          <span style={{ padding: "4px 8px", background: "var(--color-bg)", borderRadius: "4px", fontSize: "12px", fontWeight: 500 }}>
            {getTypeLabel(exp.type, exp.customType)}
          </span>
        </td>
        <td style={{ fontWeight: 600 }}>{fmt(Number(exp.amount))}</td>
        <td style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>{exp.notes || "-"}</td>
        <td style={{ textAlign: "right" }}>
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
            <button onClick={() => openEdit(exp)}
              style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-primary)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
              {lang === "en" ? "Edit" : "Düzenle"}
            </button>
            <button onClick={() => setDeleteId(exp.id)}
              style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
              {lang === "en" ? "Delete" : "Sil"}
            </button>
          </div>
        </td>
      </tr>
    ));

  return (
    <div style={{ padding: "var(--spacing-8)", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700, marginBottom: "var(--spacing-6)" }}>
        {tx(t.sabitGider.title, lang)}
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "var(--spacing-8)", alignItems: "start" }}>
        {/* Form */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>
            {lang === "en" ? "Add New Expense" : "Yeni Gider Ekle"}
          </h2>

          {error && (
            <div style={{ padding: "12px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "16px", fontSize: "14px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <div className="form-group">
              <label className="form-label">{lang === "en" ? "Expense Type" : "Gider Türü"}</label>
              <select className="form-input" name="type" value={formData.type} onChange={handleChange} required>
                <option value="INVOICE">{lang === "en" ? "Invoice" : "Fatura"}</option>
                <option value="ACCOUNTING">{lang === "en" ? "Accounting" : "Muhasebe"}</option>
                <option value="TAX">{lang === "en" ? "Tax" : "Vergi"}</option>
                <option value="RENT">{lang === "en" ? "Rent" : "Kira"}</option>
                <option value="OTHER">{lang === "en" ? "Other" : "Diğer"}</option>
              </select>
            </div>

            {formData.type === "OTHER" && (
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Custom Expense Type" : "Özel Gider Türü"}</label>
                <input type="text" className="form-input" name="customType" value={formData.customType} onChange={handleChange} required />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{lang === "en" ? "Amount (₺)" : "Tutar (₺)"}</label>
              <input type="number" step="0.01" className="form-input" name="amount" value={formData.amount} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">{lang === "en" ? "Expense Date" : "Gider Tarihi"}</label>
              <input type="date" className="form-input" name="expenseDate" value={formData.expenseDate} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">{lang === "en" ? "Notes" : "Notlar"}</label>
              <textarea className="form-input" name="notes" value={formData.notes} onChange={handleChange} rows={2} />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? (lang === "en" ? "Saving..." : "Kaydediliyor...") : (lang === "en" ? "Save Expense" : "Gider Kaydet")}
            </button>
          </form>
        </div>

        {/* Bu Ay */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>
            {lang === "en" ? "This Month" : "Bu Ay"}
          </h2>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /></div>
          ) : thisMonthExpenses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--color-text-muted)" }}>
              {lang === "en" ? "No expenses this month." : "Bu ay gider kaydı yok."}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-3)", padding: "8px 12px", background: "var(--color-bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                  {lang === "en" ? `${thisMonthExpenses.length} records` : `${thisMonthExpenses.length} kayıt`}
                </span>
                <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)", color: "var(--color-primary)" }}>
                  {fmt(thisMonthTotal)}
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: "14px" }}>
                  {expenseTableHeader}
                  <tbody>{renderExpenseRows(thisMonthExpenses)}</tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Geçmiş Kayıtlar */}
      <div className="card" style={{ marginTop: "var(--spacing-5)" }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--spacing-3)", marginBottom: "var(--spacing-4)" }}>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginRight: "auto" }}>
            {lang === "en" ? "All Records" : "Geçmiş Kayıtlar"}
          </h2>
          <div style={{ display: "flex", gap: "var(--spacing-2)", alignItems: "center", flexWrap: "wrap" }}>
            <input type="date" value={histStart} onChange={e => setHistStart(e.target.value)}
              className="form-input" style={{ width: "150px", fontSize: "13px" }} />
            <span style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>—</span>
            <input type="date" value={histEnd} onChange={e => setHistEnd(e.target.value)}
              className="form-input" style={{ width: "150px", fontSize: "13px" }} />
            {(histStart || histEnd) && (
              <button onClick={() => { setHistStart(""); setHistEnd(""); }} className="btn"
                style={{ fontSize: "12px", padding: "4px 10px", border: "1px solid var(--color-border)" }}>
                {lang === "en" ? "Clear" : "Temizle"}
              </button>
            )}
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              {historyExpenses.length} {lang === "en" ? "records" : "kayıt"}
            </span>
          </div>
        </div>
        {historyExpenses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--color-text-muted)" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📋</div>
            {lang === "en" ? "No records in selected period." : "Seçili dönemde kayıt bulunamadı."}
          </div>
        ) : (
          <div className="table-wrapper" style={{ maxHeight: "480px", overflowY: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: "14px" }}>
              {expenseTableHeader}
              <tbody>{renderExpenseRows(historyExpenses)}</tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editExpense && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "440px", padding: "var(--spacing-6)" }}>
            <h3 style={{ fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
              {lang === "en" ? "Edit Expense" : "Gideri Düzenle"}
            </h3>
            <form onSubmit={(e) => void handleEditSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Expense Type" : "Gider Türü"}</label>
                <select className="form-input" value={editForm.type} onChange={e => setEditForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="INVOICE">{lang === "en" ? "Invoice" : "Fatura"}</option>
                  <option value="ACCOUNTING">{lang === "en" ? "Accounting" : "Muhasebe"}</option>
                  <option value="TAX">{lang === "en" ? "Tax" : "Vergi"}</option>
                  <option value="RENT">{lang === "en" ? "Rent" : "Kira"}</option>
                  <option value="OTHER">{lang === "en" ? "Other" : "Diğer"}</option>
                </select>
              </div>
              {editForm.type === "OTHER" && (
                <div className="form-group">
                  <label className="form-label">{lang === "en" ? "Custom Type" : "Özel Tür"}</label>
                  <input type="text" className="form-input" value={editForm.customType} onChange={e => setEditForm(p => ({ ...p, customType: e.target.value }))} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Amount (₺)" : "Tutar (₺)"}</label>
                <input type="number" step="0.01" className="form-input" value={editForm.amount} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Expense Date" : "Gider Tarihi"}</label>
                <input type="date" className="form-input" value={editForm.expenseDate} onChange={e => setEditForm(p => ({ ...p, expenseDate: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Notes" : "Notlar"}</label>
                <textarea className="form-input" rows={2} value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: "var(--spacing-3)", marginTop: "4px" }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setEditExpense(null)}>
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

      {/* Delete Modal */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "380px", padding: "var(--spacing-6)", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🗑️</div>
            <h3 style={{ fontWeight: 700, marginBottom: "8px" }}>
              {lang === "en" ? "Delete Expense" : "Gideri Sil"}
            </h3>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--spacing-5)", fontSize: "14px" }}>
              {lang === "en" ? "Are you sure you want to delete this expense record?" : "Bu gider kaydını silmek istediğinizden emin misiniz?"}
            </p>
            <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setDeleteId(null)}>
                {lang === "en" ? "Cancel" : "İptal"}
              </button>
              <button className="btn" style={{ flex: 1, background: "var(--color-danger)", color: "white" }}
                onClick={() => void handleDelete()} disabled={deleting}>
                {deleting ? (lang === "en" ? "Deleting..." : "Siliniyor...") : (lang === "en" ? "Yes, Delete" : "Evet, Sil")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
