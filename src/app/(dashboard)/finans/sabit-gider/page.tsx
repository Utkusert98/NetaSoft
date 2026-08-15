"use client";
import { useLangContext } from "@/app/providers/LangProvider";
import { t, tx } from "@/lib/i18n/translations";
import { useState, useEffect } from "react";
import { ClipboardList, Trash2, Repeat, History } from "lucide-react";
import { format } from "date-fns";
import { tr as trLocale, enUS } from "date-fns/locale";
import DateRangePicker from "@/components/ui/DateRangePicker";
import SingleDatePicker from "@/components/ui/SingleDatePicker";

type Expense = {
  id: string;
  type: string;
  customType?: string;
  amount: number;
  expenseDate: string;
  notes?: string;
};

type RecurringSeries = {
  recurringId: string;
  type: string;
  customType: string | null;
  count: number;
  total: number;
  startDate: string;
  endDate: string;
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

  // "Düzenli Ödeme" — kira, kredi kartı borcu gibi sözleşme boyunca sabit
  // tutarlı bir gideri, seçilen sıklıkta (aylık/yıllık/günlük) tarih
  // aralığına yayarak tek seferde birden fazla FixedExpense satırı olarak
  // oluşturur (gerçek bir kullanıcı talebiyle eklendi).
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringForm, setRecurringForm] = useState({
    type: "RENT", customType: "", amount: "", frequency: "MONTHLY" as "MONTHLY" | "YEARLY" | "DAILY",
    startDate: "", endDate: "", notes: "",
  });
  const [recurringSubmitting, setRecurringSubmitting] = useState(false);
  const [recurringError, setRecurringError] = useState("");
  const [recurringResult, setRecurringResult] = useState<number | null>(null);
  const [recurringSeries, setRecurringSeries] = useState<RecurringSeries[]>([]);
  const [recurringSeriesLoading, setRecurringSeriesLoading] = useState(false);
  const [recurringDeleteTarget, setRecurringDeleteTarget] = useState<RecurringSeries | null>(null);
  const [recurringDeleting, setRecurringDeleting] = useState(false);

  const fetchExpenses = async () => {
    try {
      const res = await fetch("/api/v1/finans/sabit-gider", { headers: { "Accept-Language": lang } });
      const json = await res.json();
      if (json.success) setExpenses(json.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchRecurringSeries = async () => {
    setRecurringSeriesLoading(true);
    try {
      const res = await fetch("/api/v1/finans/sabit-gider/recurring", { headers: { "Accept-Language": lang } });
      const json = await res.json();
      if (json.success) setRecurringSeries(json.data);
    } catch (e) { console.error(e); }
    finally { setRecurringSeriesLoading(false); }
  };

  // Mount üzerinde tek seferlik async veri çekimi — setState çağrısı fetch tamamlandıktan
  // sonra (await sonrası) gerçekleşir, senkron değildir; bu yüzden kural burada
  // yanlış pozitif üretir.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchExpenses(); void fetchRecurringSeries(); }, []);

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

  const openRecurringModal = () => {
    setRecurringError("");
    setRecurringResult(null);
    setRecurringForm({
      type: "RENT", customType: "", amount: "", frequency: "MONTHLY",
      startDate: new Date().toISOString().split("T")[0], endDate: "", notes: "",
    });
    setShowRecurringModal(true);
  };

  const handleRecurringSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recurringForm.startDate || !recurringForm.endDate) return;
    setRecurringSubmitting(true);
    setRecurringError("");
    setRecurringResult(null);
    try {
      const res = await fetch("/api/v1/finans/sabit-gider/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({
          type: recurringForm.type,
          customType: recurringForm.type === "OTHER" ? recurringForm.customType : undefined,
          amount: parseFloat(recurringForm.amount),
          frequency: recurringForm.frequency,
          startDate: recurringForm.startDate,
          endDate: recurringForm.endDate,
          notes: recurringForm.notes || undefined,
          recurringId: crypto.randomUUID(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
      setRecurringResult(json.data.created);
      await Promise.all([fetchExpenses(), fetchRecurringSeries()]);
    } catch (err: unknown) {
      setRecurringError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
    } finally {
      setRecurringSubmitting(false);
    }
  };

  const handleRecurringDelete = async () => {
    if (!recurringDeleteTarget) return;
    setRecurringDeleting(true);
    try {
      await fetch(`/api/v1/finans/sabit-gider/recurring/${encodeURIComponent(recurringDeleteTarget.recurringId)}`, {
        method: "DELETE", headers: { "Accept-Language": lang },
      });
      setRecurringDeleteTarget(null);
      await Promise.all([fetchExpenses(), fetchRecurringSeries()]);
    } catch (e) { console.error(e); }
    finally { setRecurringDeleting(false); }
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
    <div className="page-content">
      <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700, marginBottom: "var(--spacing-6)" }}>
        {tx(t.sabitGider.title, lang)}
      </h1>

      <div className="responsive-grid form-list-grid" style={{ gap: "var(--spacing-8)", alignItems: "start" }}>
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
              <SingleDatePicker value={formData.expenseDate} onChange={(date) => setFormData(prev => ({ ...prev, expenseDate: date }))} lang={lang} required />
            </div>

            <div className="form-group">
              <label className="form-label">{lang === "en" ? "Notes" : "Notlar"}</label>
              <textarea className="form-input" name="notes" value={formData.notes} onChange={handleChange} rows={2} />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? (lang === "en" ? "Saving..." : "Kaydediliyor...") : (lang === "en" ? "Save Expense" : "Gider Kaydet")}
            </button>
          </form>

          {/* Kira, kredi kartı borcu gibi sözleşme boyunca sabit tutarlı
              giderleri her ay elle tek tek girmek yerine tarih aralığına
              yayarak tek seferde oluşturmak için (gerçek bir kullanıcı
              talebiyle eklendi). */}
          <button type="button" onClick={openRecurringModal}
            className="btn btn-full"
            style={{ marginTop: "var(--spacing-3)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", border: "1px solid var(--color-border)" }}>
            <Repeat size={15} />
            {lang === "en" ? "Add Recurring Payment" : "Düzenli Ödeme Ekle"}
          </button>
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
            <DateRangePicker startDate={histStart} endDate={histEnd} lang={lang}
              onChange={(start, end) => { setHistStart(start); setHistEnd(end); }} />
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
            <div style={{ marginBottom: "8px", display: "flex", justifyContent: "center" }}><ClipboardList size={28} /></div>
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

      {/* Düzenli Ödemeler — kullanıcı sözleşme değişince/bittiğinde tek tek
          ay ay silmek yerine tüm seriyi tek işlemle geri alabilsin diye
          (Kasa'daki "İçe Aktarma Geçmişi" ile aynı desen). Hiç düzenli
          ödeme yoksa bölüm hiç gösterilmez. */}
      {(recurringSeriesLoading || recurringSeries.length > 0) && (
        <div className="card" style={{ marginTop: "var(--spacing-5)", padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <History size={16} style={{ color: "var(--color-text-muted)" }} />
            {lang === "en" ? "Recurring Payments" : "Düzenli Ödemeler"}
          </div>
          {recurringSeriesLoading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /></div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th>{lang === "en" ? "Type" : "Tür"}</th>
                    <th>{lang === "en" ? "Date Range" : "Tarih Aralığı"}</th>
                    <th>{lang === "en" ? "Record Count" : "Kayıt Sayısı"}</th>
                    <th>{lang === "en" ? "Total" : "Toplam"}</th>
                    <th style={{ textAlign: "right" }}>{lang === "en" ? "Actions" : "İşlem"}</th>
                  </tr>
                </thead>
                <tbody>
                  {recurringSeries.map(s => (
                    <tr key={s.recurringId}>
                      <td>
                        <span style={{ padding: "4px 8px", background: "var(--color-bg)", borderRadius: "4px", fontSize: "12px", fontWeight: 500 }}>
                          {getTypeLabel(s.type, s.customType ?? undefined)}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontSize: "12px", color: "var(--color-text-muted)" }}>
                        {format(new Date(`${s.startDate}T00:00:00.000Z`), "dd MMM yyyy", { locale })} – {format(new Date(`${s.endDate}T00:00:00.000Z`), "dd MMM yyyy", { locale })}
                      </td>
                      <td>{s.count.toLocaleString("tr-TR")}</td>
                      <td style={{ fontWeight: 700 }}>{fmt(s.total)}</td>
                      <td style={{ textAlign: "right" }}>
                        <button onClick={() => setRecurringDeleteTarget(s)}
                          style={{ padding: "3px 8px", fontSize: "11px", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                          {lang === "en" ? "Delete This Series" : "Bu Seriyi Sil"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Düzenli Ödeme Modal */}
      {showRecurringModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "460px", maxHeight: "90vh", overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "var(--spacing-6)" }}>
            <h3 style={{ fontWeight: 700, marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Repeat size={18} />
              {lang === "en" ? "Add Recurring Payment" : "Düzenli Ödeme Ekle"}
            </h3>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "var(--spacing-4)" }}>
              {lang === "en"
                ? "For fixed-amount expenses over a contract period (rent, credit card debt, etc.) — creates one entry per month/year/day across the range."
                : "Sözleşme boyunca sabit tutarlı giderler için (kira, kredi kartı borcu vb.) — seçilen aralıkta ay/yıl/gün başına bir kayıt oluşturur."}
            </p>

            {recurringResult !== null && (
              <div style={{ padding: "12px", background: "var(--color-income-bg, rgba(74,222,128,0.1))", color: "var(--color-income-green)", borderRadius: "var(--radius-md)", marginBottom: "16px", fontSize: "14px", fontWeight: 600 }}>
                {lang === "en" ? `${recurringResult} record(s) created.` : `${recurringResult} kayıt oluşturuldu.`}
              </div>
            )}
            {recurringError && (
              <div style={{ padding: "12px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "16px", fontSize: "14px" }}>
                {recurringError}
              </div>
            )}

            <form onSubmit={(e) => void handleRecurringSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Expense Type" : "Gider Türü"}</label>
                <select className="form-input" value={recurringForm.type} onChange={e => setRecurringForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="RENT">{lang === "en" ? "Rent" : "Kira"}</option>
                  <option value="INVOICE">{lang === "en" ? "Invoice" : "Fatura"}</option>
                  <option value="ACCOUNTING">{lang === "en" ? "Accounting" : "Muhasebe"}</option>
                  <option value="TAX">{lang === "en" ? "Tax" : "Vergi"}</option>
                  <option value="OTHER">{lang === "en" ? "Other" : "Diğer"}</option>
                </select>
              </div>
              {recurringForm.type === "OTHER" && (
                <div className="form-group">
                  <label className="form-label">{lang === "en" ? "Custom Expense Type" : "Özel Gider Türü"}</label>
                  <input type="text" className="form-input" value={recurringForm.customType}
                    onChange={e => setRecurringForm(p => ({ ...p, customType: e.target.value }))} required />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Amount per period (₺)" : "Dönem Başına Tutar (₺)"}</label>
                <input type="number" step="0.01" min="0.01" className="form-input" value={recurringForm.amount}
                  onChange={e => setRecurringForm(p => ({ ...p, amount: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Frequency" : "Sıklık"}</label>
                <select className="form-input" value={recurringForm.frequency}
                  onChange={e => setRecurringForm(p => ({ ...p, frequency: e.target.value as typeof recurringForm.frequency }))}>
                  <option value="MONTHLY">{lang === "en" ? "Monthly" : "Aylık"}</option>
                  <option value="YEARLY">{lang === "en" ? "Yearly" : "Yıllık"}</option>
                  <option value="DAILY">{lang === "en" ? "Daily" : "Günlük"}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Date Range" : "Tarih Aralığı"}</label>
                <DateRangePicker startDate={recurringForm.startDate} endDate={recurringForm.endDate} lang={lang}
                  onChange={(start, end) => setRecurringForm(p => ({ ...p, startDate: start, endDate: end }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Notes" : "Notlar"}</label>
                <textarea className="form-input" rows={2} value={recurringForm.notes}
                  onChange={e => setRecurringForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: "var(--spacing-3)", marginTop: "4px" }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setShowRecurringModal(false)}>
                  {lang === "en" ? "Close" : "Kapat"}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}
                  disabled={recurringSubmitting || !recurringForm.startDate || !recurringForm.endDate}>
                  {recurringSubmitting ? (lang === "en" ? "Creating..." : "Oluşturuluyor...") : (lang === "en" ? "Create" : "Oluştur")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Düzenli Ödeme Serisi Silme Onayı */}
      {recurringDeleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "380px", padding: "var(--spacing-6)", textAlign: "center" }}>
            <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center", color: "var(--color-danger)" }}><Trash2 size={36} /></div>
            <h3 style={{ fontWeight: 700, marginBottom: "8px" }}>
              {lang === "en" ? "Delete Recurring Series" : "Düzenli Ödeme Serisini Sil"}
            </h3>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--spacing-5)", fontSize: "14px" }}>
              {lang === "en"
                ? <>All {recurringDeleteTarget.count} record(s) in this series will be deleted. This action cannot be undone.</>
                : <>Bu seriye ait TÜM {recurringDeleteTarget.count} kayıt silinecek. Bu işlem geri alınamaz.</>}
            </p>
            <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setRecurringDeleteTarget(null)}>
                {lang === "en" ? "Cancel" : "İptal"}
              </button>
              <button className="btn" style={{ flex: 1, background: "var(--color-danger)", color: "white" }}
                onClick={() => void handleRecurringDelete()} disabled={recurringDeleting}>
                {recurringDeleting ? (lang === "en" ? "Deleting..." : "Siliniyor...") : (lang === "en" ? "Yes, Delete" : "Evet, Sil")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editExpense && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "440px", padding: "var(--spacing-6)" }}>
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
                <SingleDatePicker value={editForm.expenseDate} onChange={(date) => setEditForm(p => ({ ...p, expenseDate: date }))} lang={lang} required />
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "380px", padding: "var(--spacing-6)", textAlign: "center" }}>
            <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center", color: "var(--color-danger)" }}><Trash2 size={36} /></div>
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
