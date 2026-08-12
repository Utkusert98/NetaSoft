"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { useLangContext } from "@/app/providers/LangProvider";
import { format } from "date-fns";
import { tr as trLocale, enUS } from "date-fns/locale";
import DateRangePicker from "@/components/ui/DateRangePicker";
import SingleDatePicker from "@/components/ui/SingleDatePicker";

interface SupplierTransfer {
  id: string;
  supplierName: string;
  amount: number;
  currency: string;
  transferDate: string;
  notes?: string;
}

const EMPTY = {
  supplierName: "",
  amount: "",
  transferDate: new Date().toISOString().split("T")[0],
  notes: "",
};

export default function DepoHavalesiPage() {
  const { lang } = useLangContext();
  const locale = lang === "en" ? enUS : trLocale;
  const [transfers, setTransfers] = useState<SupplierTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editTransfer, setEditTransfer] = useState<SupplierTransfer | null>(null);
  const [editForm, setEditForm] = useState({ supplierName: "", amount: "", transferDate: "", notes: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [histStart, setHistStart] = useState("");
  const [histEnd, setHistEnd] = useState("");

  const fetchTransfers = async () => {
    try {
      const res = await fetch("/api/v1/finans/depo-havalesi", { headers: { "Accept-Language": lang } });
      const json = await res.json() as { success: boolean; data?: SupplierTransfer[] };
      if (json.success && json.data) setTransfers(json.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Mount üzerinde tek seferlik async veri çekimi — setState çağrısı fetch tamamlandıktan
  // sonra (await sonrası) gerçekleşir, senkron değildir; bu yüzden kural burada
  // yanlış pozitif üretir.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchTransfers(); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/v1/finans/depo-havalesi", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({
          supplierName: form.supplierName,
          amount: parseFloat(form.amount),
          transferDate: form.transferDate + "T00:00:00.000Z",
          notes: form.notes,
        }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
      setForm(EMPTY);
      await fetchTransfers();
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
      await fetch(`/api/v1/finans/depo-havalesi/${deleteId}`, { method: "DELETE", headers: { "Accept-Language": lang } });
      setDeleteId(null);
      await fetchTransfers();
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  };

  const openEdit = (tr: SupplierTransfer) => {
    setEditTransfer(tr);
    setEditForm({
      supplierName: tr.supplierName,
      amount: String(tr.amount),
      transferDate: new Date(tr.transferDate).toISOString().split("T")[0],
      notes: tr.notes ?? "",
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTransfer) return;
    setEditSubmitting(true);
    try {
      await fetch(`/api/v1/finans/depo-havalesi/${editTransfer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({
          supplierName: editForm.supplierName,
          amount: parseFloat(editForm.amount),
          transferDate: editForm.transferDate + "T00:00:00.000Z",
          notes: editForm.notes,
        }),
      });
      setEditTransfer(null);
      await fetchTransfers();
    } catch (e) { console.error(e); }
    finally { setEditSubmitting(false); }
  };

  const fmt = (v: number) => Number(v).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });

  const totalAmount = transfers.reduce((s, tr) => s + Number(tr.amount), 0);

  const nowM = new Date();
  const thisMonthTransfers = transfers.filter(tr => {
    const d = new Date(tr.transferDate);
    return d.getMonth() === nowM.getMonth() && d.getFullYear() === nowM.getFullYear();
  });
  const historyTransfers = transfers.filter(tr => {
    const d = tr.transferDate.substring(0, 10);
    if (histStart && d < histStart) return false;
    if (histEnd && d > histEnd) return false;
    return true;
  });
  const thisMonthTotal = thisMonthTransfers.reduce((s, tr) => s + Number(tr.amount), 0);

  const transferTableHeader = (
    <thead>
      <tr>
        <th>{lang === "en" ? "Date" : "Tarih"}</th>
        <th>{lang === "en" ? "Warehouse" : "Depo"}</th>
        <th>{lang === "en" ? "Amount" : "Tutar"}</th>
        <th>{lang === "en" ? "Description" : "Açıklama"}</th>
        <th style={{ textAlign: "right" }}>{lang === "en" ? "Actions" : "İşlem"}</th>
      </tr>
    </thead>
  );

  const renderTransferRows = (rows: SupplierTransfer[]) =>
    rows.map(tr => (
      <tr key={tr.id}>
        <td style={{ whiteSpace: "nowrap" }}>
          {format(new Date(tr.transferDate), "dd MMM yyyy", { locale })}
        </td>
        <td style={{ fontWeight: 600 }}>{tr.supplierName}</td>
        <td style={{ fontWeight: 700, color: "var(--color-danger)" }}>
          {fmt(Number(tr.amount))}
        </td>
        <td style={{ color: "var(--color-text-muted)", fontSize: "13px", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {tr.notes || "—"}
        </td>
        <td style={{ textAlign: "right" }}>
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
            <button onClick={() => openEdit(tr)}
              style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-primary)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
              {lang === "en" ? "Edit" : "Düzenle"}
            </button>
            <button onClick={() => setDeleteId(tr.id)}
              style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
              {lang === "en" ? "Delete" : "Sil"}
            </button>
          </div>
        </td>
      </tr>
    ));

  return (
    <div style={{ padding: "var(--spacing-8)", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ marginBottom: "var(--spacing-6)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700 }}>
          {lang === "en" ? "Warehouse Transfer / EFT" : "Depo Havalesi / EFT"}
        </h1>
        <p style={{ color: "var(--color-text-muted)", marginTop: "4px" }}>
          {lang === "en"
            ? "Record wire transfers and EFT payments made to the warehouse."
            : "Depoya yapılan havale ve EFT ödemelerini kaydedin."}
        </p>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }}>
        {[
          {
            label: lang === "en" ? "Total Transfers" : "Toplam Havale",
            value: transfers.length + (lang === "en" ? " Records" : " İşlem"),
          },
          {
            label: lang === "en" ? "Period Total" : "Bu Dönem Toplam",
            value: totalAmount.toLocaleString("tr-TR", { style: "currency", currency: "TRY" }),
          },
          {
            label: lang === "en" ? "Last Transfer" : "Son Havale",
            value: transfers[0] ? transfers[0].supplierName : "—",
          },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: "var(--spacing-4)" }}>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>{c.label}</div>
            <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 700 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="responsive-grid form-list-grid" style={{ "--form-list-col": "360px", gap: "var(--spacing-6)", alignItems: "start" } as CSSProperties}>

        {/* Form */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-5)" }}>
            {lang === "en" ? "Add New Transfer" : "Yeni Havale Ekle"}
          </h2>

          {error && (
            <div style={{ padding: "12px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "16px", fontSize: "14px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <div className="form-group">
              <label className="form-label required">
                {lang === "en" ? "Warehouse Name" : "Depo Adı"}
              </label>
              <input
                type="text" className="form-input" name="supplierName"
                value={form.supplierName} onChange={handleChange}
                placeholder={lang === "en" ? "Bağfaş, Hedef Ecza, etc." : "Bağfaş, Hedef Ecza vb."}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label required">
                {lang === "en" ? "Transfer Amount (₺)" : "Havale Tutarı (₺)"}
              </label>
              <input
                type="number" step="0.01" min="0.01" className="form-input" name="amount"
                value={form.amount} onChange={handleChange}
                placeholder="0,00" required
              />
            </div>

            <div className="form-group">
              <label className="form-label required">
                {lang === "en" ? "Transfer Date" : "Havale Tarihi"}
              </label>
              <SingleDatePicker
                value={form.transferDate} onChange={(date) => setForm(p => ({ ...p, transferDate: date }))} lang={lang} required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                {lang === "en" ? "Description" : "Açıklama"}
              </label>
              <textarea
                className="form-input" name="notes" rows={2}
                value={form.notes} onChange={handleChange}
                placeholder={lang === "en" ? "Invoice no, description, etc. (optional)" : "Fatura no, açıklama vb. (isteğe bağlı)"}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting
                ? (lang === "en" ? "Saving..." : "Kaydediliyor...")
                : (lang === "en" ? "Save Transfer" : "Havale Kaydet")}
            </button>
          </form>
        </div>

        {/* Bu Ay */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
            {lang === "en" ? "This Month" : "Bu Ay"}
          </h2>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /></div>
          ) : thisMonthTransfers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--color-text-muted)", fontSize: "14px" }}>
              {lang === "en" ? "No transfer records this month." : "Bu ay havale kaydı yok."}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-3)", padding: "8px 12px", background: "var(--color-bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                  {lang === "en" ? `${thisMonthTransfers.length} records` : `${thisMonthTransfers.length} kayıt`}
                </span>
                <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)", color: "var(--color-primary)" }}>
                  {fmt(thisMonthTotal)}
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: "14px" }}>
                  {transferTableHeader}
                  <tbody>{renderTransferRows(thisMonthTransfers)}</tbody>
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
              {historyTransfers.length} {lang === "en" ? "records" : "kayıt"}
            </span>
          </div>
        </div>
        {historyTransfers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--color-text-muted)" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📋</div>
            {lang === "en" ? "No records in selected period." : "Seçili dönemde kayıt bulunamadı."}
          </div>
        ) : (
          <div className="table-wrapper" style={{ maxHeight: "480px", overflowY: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: "14px" }}>
              {transferTableHeader}
              <tbody>{renderTransferRows(historyTransfers)}</tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editTransfer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "440px", padding: "var(--spacing-6)" }}>
            <h3 style={{ fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
              {lang === "en" ? "Edit Transfer" : "Havaleyi Düzenle"}
            </h3>
            <form onSubmit={(e) => void handleEditSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Warehouse Name" : "Depo Adı"}</label>
                <input type="text" className="form-input" value={editForm.supplierName} onChange={e => setEditForm(p => ({ ...p, supplierName: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Amount (₺)" : "Tutar (₺)"}</label>
                <input type="number" step="0.01" className="form-input" value={editForm.amount} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Transfer Date" : "Havale Tarihi"}</label>
                <SingleDatePicker value={editForm.transferDate} onChange={(date) => setEditForm(p => ({ ...p, transferDate: date }))} lang={lang} required />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Description" : "Açıklama"}</label>
                <textarea className="form-input" rows={2} value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: "var(--spacing-3)", marginTop: "4px" }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setEditTransfer(null)}>
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
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🗑️</div>
            <h3 style={{ fontWeight: 700, marginBottom: "8px" }}>
              {lang === "en" ? "Delete Transfer" : "Havaleyi Sil"}
            </h3>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--spacing-5)", fontSize: "14px" }}>
              {lang === "en"
                ? "Are you sure you want to delete this transfer record?"
                : "Bu havale kaydını silmek istediğinizden emin misiniz?"}
            </p>
            <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setDeleteId(null)}>
                {lang === "en" ? "Cancel" : "İptal"}
              </button>
              <button
                className="btn"
                style={{ flex: 1, background: "var(--color-danger)", color: "white" }}
                onClick={() => void handleDelete()}
                disabled={deleting}
              >
                {deleting ? (lang === "en" ? "Deleting..." : "Siliniyor...") : (lang === "en" ? "Yes, Delete" : "Evet, Sil")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
