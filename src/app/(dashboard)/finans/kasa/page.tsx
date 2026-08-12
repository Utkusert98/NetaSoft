"use client";
import { useLangContext } from "@/app/providers/LangProvider";
import { t, tx } from "@/lib/i18n/translations";
import { useState, useEffect, type CSSProperties } from "react";
import { format } from "date-fns";
import { tr as trLocale, enUS } from "date-fns/locale";
import DateRangePicker from "@/components/ui/DateRangePicker";
import SingleDatePicker from "@/components/ui/SingleDatePicker";

type Register = {
  id: string;
  registerDate: string;
  posAmount: number;
  cashAmount: number;
  wireAmount: number;
  notes?: string;
};

const emptyForm = {
  registerDate: new Date().toISOString().split("T")[0],
  posAmount: "",
  cashAmount: "",
  wireAmount: "",
  notes: "",
};

export default function KasaPage() {
  const { lang } = useLangContext();
  const locale = lang === "en" ? enUS : trLocale;
  const [records, setRecords] = useState<Register[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(emptyForm);

  const [editRecord, setEditRecord] = useState<Register | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [histStart, setHistStart] = useState("");
  const [histEnd, setHistEnd] = useState("");

  const fetchRecords = async () => {
    try {
      const res = await fetch("/api/v1/finans/kasa", { headers: { "Accept-Language": lang } });
      const json = await res.json();
      if (json.success) setRecords(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Async veri çekimi — setState await sonrası çalışır, senkron değildir.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchRecords(); }, [lang]);

  const calcTotal = (d: typeof emptyForm | Register) =>
    [Number(d.posAmount) || 0, Number(d.cashAmount) || 0, Number(d.wireAmount) || 0].reduce((a, b) => a + b, 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        registerDate: formData.registerDate,
        posAmount: parseFloat(formData.posAmount || "0"),
        cashAmount: parseFloat(formData.cashAmount || "0"),
        wireAmount: parseFloat(formData.wireAmount || "0"),
        foreignCurrencyAmount: 0,
        foreignCurrencyType: "USD",
        notes: formData.notes,
      };
      const res = await fetch("/api/v1/finans/kasa", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
      setFormData(emptyForm);
      await fetchRecords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
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
      notes: rec.notes || "",
    });
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord) return;
    setEditSubmitting(true);
    try {
      const payload = {
        registerDate: editForm.registerDate,
        posAmount: parseFloat(editForm.posAmount || "0"),
        cashAmount: parseFloat(editForm.cashAmount || "0"),
        wireAmount: parseFloat(editForm.wireAmount || "0"),
        foreignCurrencyAmount: 0,
        foreignCurrencyType: "USD",
        notes: editForm.notes,
      };
      const res = await fetch(`/api/v1/finans/kasa/${editRecord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
      setEditRecord(null);
      await fetchRecords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/v1/finans/kasa/${deleteId}`, { method: "DELETE", headers: { "Accept-Language": lang } });
      if (!res.ok) throw new Error(lang === "en" ? "Delete failed" : "Silme işlemi başarısız");
      setDeleteId(null);
      await fetchRecords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const fmt = (v: number) => Number(v).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });

  const nowM = new Date();
  const thisMonthRecords = records.filter(r => {
    const d = new Date(r.registerDate);
    return d.getMonth() === nowM.getMonth() && d.getFullYear() === nowM.getFullYear();
  });
  const historyRecords = records.filter(r => {
    const d = r.registerDate.substring(0, 10);
    if (histStart && d < histStart) return false;
    if (histEnd && d > histEnd) return false;
    return true;
  });
  const thisMonthTotal = thisMonthRecords.reduce(
    (sum, r) => sum + Number(r.posAmount) + Number(r.cashAmount) + Number(r.wireAmount),
    0
  );

  const channelFields = [
    { name: "posAmount", label: "💳 POS" },
    { name: "cashAmount", label: lang === "en" ? "💵 Cash" : "💵 Nakit" },
    { name: "wireAmount", label: lang === "en" ? "🏦 Wire / EFT" : "🏦 Havale / EFT" },
  ];

  const kasaTableHeader = (
    <thead>
      <tr>
        <th>{lang === "en" ? "Date" : "Tarih"}</th>
        <th style={{ textAlign: "right" }}>POS</th>
        <th style={{ textAlign: "right" }}>{lang === "en" ? "Cash" : "Nakit"}</th>
        <th style={{ textAlign: "right" }}>{lang === "en" ? "Wire" : "Havale"}</th>
        <th style={{ textAlign: "right" }}>{lang === "en" ? "Total" : "Toplam"}</th>
        <th>{lang === "en" ? "Notes" : "Notlar"}</th>
        <th style={{ textAlign: "center" }}>{lang === "en" ? "Actions" : "İşlem"}</th>
      </tr>
    </thead>
  );

  const renderKasaRows = (rows: Register[]) =>
    rows.map(rec => {
      const total = Number(rec.posAmount) + Number(rec.cashAmount) + Number(rec.wireAmount);
      return (
        <tr key={rec.id}>
          <td style={{ fontWeight: 600 }}>
            {format(new Date(rec.registerDate), "dd MMM yyyy", { locale })}
          </td>
          <td style={{ textAlign: "right" }}>{fmt(Number(rec.posAmount))}</td>
          <td style={{ textAlign: "right" }}>{fmt(Number(rec.cashAmount))}</td>
          <td style={{ textAlign: "right" }}>{fmt(Number(rec.wireAmount))}</td>
          <td style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700, color: "var(--color-primary)" }}>{fmt(total)}</div>
          </td>
          <td style={{ color: "var(--color-text-muted)", fontSize: "13px", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {rec.notes || "—"}
          </td>
          <td style={{ textAlign: "center" }}>
            <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
              <button onClick={() => openEdit(rec)}
                style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "none", background: "var(--color-primary)", cursor: "pointer", fontSize: "12px", color: "white", fontWeight: 500 }}>
                {lang === "en" ? "Edit" : "Düzenle"}
              </button>
              <button onClick={() => setDeleteId(rec.id)}
                style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-danger)", background: "transparent", cursor: "pointer", fontSize: "12px", color: "var(--color-danger)" }}>
                🗑️ {lang === "en" ? "Delete" : "Sil"}
              </button>
            </div>
          </td>
        </tr>
      );
    });

  return (
    <div className="page-content">
      <div style={{ marginBottom: "var(--spacing-6)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700 }}>{tx(t.kasa.title, lang)}</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "14px", marginTop: "4px" }}>
          {lang === "en"
            ? "Record daily POS, cash, and wire transfer collections."
            : "Günlük POS, nakit ve havale tahsilatlarını kayıt altına alın."}
        </p>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "24px", fontSize: "14px" }}>
          {error}
          <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div className="responsive-grid form-list-grid" style={{ "--form-list-col": "340px", gap: "var(--spacing-8)", alignItems: "start" } as CSSProperties}>
        {/* FORM */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-5)" }}>
            📅 {lang === "en" ? "New Register Entry" : "Yeni Kasa Girişi"}
          </h2>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <div className="form-group">
              <label className="form-label">{lang === "en" ? "Date" : "Tarih"}</label>
              <SingleDatePicker value={formData.registerDate} onChange={(date) => setFormData(prev => ({ ...prev, registerDate: date }))} lang={lang} required />
            </div>

            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "16px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {lang === "en" ? "Collection Channels (₺)" : "Tahsilat Kanalları (₺)"}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {channelFields.map(field => (
                  <div key={field.name} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px", alignItems: "center" }}>
                    <label style={{ fontSize: "13px", fontWeight: 500 }}>{field.label}</label>
                    <input type="number" step="0.01" min="0" className="form-input" name={field.name}
                      value={(formData as Record<string, string>)[field.name]} onChange={handleChange} placeholder="0,00" />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: "14px 16px", background: "var(--color-primary-light)", borderRadius: "var(--radius-md)", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--color-primary)" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-on-primary-light)" }}>
                {lang === "en" ? "Total (TRY)" : "Toplam (TL)"}
              </span>
              <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-on-primary-light)" }}>
                {calcTotal(formData).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">{lang === "en" ? "Notes" : "Notlar"}</label>
              <textarea className="form-input" name="notes" value={formData.notes} onChange={handleChange} rows={2}
                placeholder={lang === "en" ? "Optional..." : "İsteğe bağlı..."} />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? (lang === "en" ? "Saving..." : "Kaydediliyor...") : (lang === "en" ? "✓ Close Register" : "✓ Kasayı Kapat")}
            </button>
          </form>
        </div>

        {/* BU AY */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>
            {lang === "en" ? "This Month" : "Bu Ay"}
          </h2>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}><div className="spinner" /></div>
          ) : thisMonthRecords.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-text-muted)" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🏦</div>
              {lang === "en" ? "No cash records this month." : "Bu ay kasa kaydı yok."}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-3)", padding: "8px 12px", background: "var(--color-bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                  {lang === "en" ? `${thisMonthRecords.length} records` : `${thisMonthRecords.length} kayıt`}
                </span>
                <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)", color: "var(--color-primary)" }}>
                  {fmt(thisMonthTotal)}
                </span>
              </div>
              <div className="table-wrapper">
                <table className="table" style={{ width: "100%", fontSize: "14px" }}>
                  {kasaTableHeader}
                  <tbody>{renderKasaRows(thisMonthRecords)}</tbody>
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
              {historyRecords.length} {lang === "en" ? "records" : "kayıt"}
            </span>
          </div>
        </div>
        {historyRecords.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--color-text-muted)" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📋</div>
            {lang === "en" ? "No records in selected period." : "Seçili dönemde kayıt bulunamadı."}
          </div>
        ) : (
          <div className="table-wrapper" style={{ maxHeight: "480px", overflowY: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: "14px" }}>
              {kasaTableHeader}
              <tbody>{renderKasaRows(historyRecords)}</tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editRecord && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "420px", maxHeight: "90vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>
              {lang === "en" ? "Edit Register Record" : "Kasa Kaydını Düzenle"}
            </h3>
            <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Date" : "Tarih"}</label>
                <SingleDatePicker value={editForm.registerDate} onChange={(date) => setEditForm(prev => ({ ...prev, registerDate: date }))} lang={lang} required />
              </div>
              {[
                { name: "posAmount", label: "POS (₺)" },
                { name: "cashAmount", label: lang === "en" ? "Cash (₺)" : "Nakit (₺)" },
                { name: "wireAmount", label: lang === "en" ? "Wire / EFT (₺)" : "Havale / EFT (₺)" },
              ].map(field => (
                <div key={field.name} className="form-group">
                  <label className="form-label">{field.label}</label>
                  <input type="number" step="0.01" min="0" className="form-input" name={field.name}
                    value={(editForm as Record<string, string>)[field.name]} onChange={handleEditChange} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Notes" : "Notlar"}</label>
                <textarea className="form-input" name="notes" value={editForm.notes} onChange={handleEditChange} rows={2} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <button type="button" className="btn" onClick={() => setEditRecord(null)} style={{ border: "1px solid var(--color-border)" }}>
                  {lang === "en" ? "Cancel" : "İptal"}
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "380px" }}>
            <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "12px" }}>
              {lang === "en" ? "Confirm Delete" : "Silmeyi Onayla"}
            </h3>
            <p style={{ color: "var(--color-text-muted)", fontSize: "14px", marginBottom: "24px" }}>
              {lang === "en"
                ? "This register record will be deleted. This action cannot be undone."
                : "Bu kasa kapatma kaydı silinecek. Bu işlem geri alınamaz."}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <button className="btn" onClick={() => setDeleteId(null)} style={{ border: "1px solid var(--color-border)" }}>
                {lang === "en" ? "Cancel" : "İptal"}
              </button>
              <button className="btn" onClick={() => void handleDelete()} disabled={deleteSubmitting}
                style={{ background: "var(--color-danger)", color: "white", border: "none" }}>
                {deleteSubmitting ? (lang === "en" ? "Deleting..." : "Siliniyor...") : (lang === "en" ? "Yes, Delete" : "Evet, Sil")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
