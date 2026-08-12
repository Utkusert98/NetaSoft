"use client";
import { useLangContext } from "@/app/providers/LangProvider";
import { t, tx } from "@/lib/i18n/translations";

import { useState, useEffect, useRef } from "react";
import { format, addMonths } from "date-fns";
import { tr, enUS } from "date-fns/locale";
import type { ParsedSgkInvoice } from "@/app/api/v1/finans/sgk-fatura/parse-pdf/route";
import DateRangePicker from "@/components/ui/DateRangePicker";
import SingleDatePicker from "@/components/ui/SingleDatePicker";

// ── Çoklu PDF yükleme ve onay bileşeni ─────────────────────────────────────
function PdfUploadReview({
  onSaved,
  onError,
}: {
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const { lang } = useLangContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedSgkInvoice[]>([]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"idle" | "review" | "done">("idle");

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setParsing(true);
    setRows([]);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/v1/finans/sgk-fatura/parse-pdf", { method: "POST", headers: { "Accept-Language": lang }, body: fd });
      const json = await res.json() as { success: boolean; data?: ParsedSgkInvoice[]; error?: string };
      if (!json.success) throw new Error(json.error ?? (lang === "en" ? "PDF could not be processed" : "PDF işlenemedi"));
      setRows(json.data ?? []);
      setStep("review");
    } catch (e) {
      onError(e instanceof Error ? e.message : (lang === "en" ? "Could not read PDF" : "PDF okunamadı"));
    } finally {
      setParsing(false);
    }
  };

  const updateRow = (i: number, key: keyof ParsedSgkInvoice, val: string | number) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await Promise.all(rows.map((row) =>
        fetch("/api/v1/finans/sgk-fatura", {
          method: "POST",
          headers: { "Content-Type": "application/json" , "Accept-Language": lang },
          body: JSON.stringify({
            invoiceDate: row.invoiceDate,
            invoiceType: row.invoiceType,
            amount: Number(row.amount),
            notes: row.notes,
          }),
        })
      ));
      setStep("done");
      setRows([]);
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : (lang === "en" ? "Save error" : "Kayıt hatası"));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => { setStep("idle"); setRows([]); if (inputRef.current) inputRef.current.value = ""; };

  return (
    <div className="card" style={{ marginBottom: "var(--spacing-6)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--spacing-4)" }}>
        <div>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700 }}>{lang === "en" ? "📂 Upload Invoice from PDF" : "📂 PDF'den Fatura Yükle"}</h2>
          <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "2px" }}>
            {lang === "en" ? "Select multiple SGK invoice PDF files — the system reads them automatically; you review and confirm." : "Birden fazla SGK faturası PDF dosyası seçin — sistem otomatik okur, siz düzenler ve onaylarsınız."}
          </p>
        </div>
        {step === "review" && (
          <button onClick={reset} className="btn" style={{ fontSize: "var(--font-size-xs)", padding: "6px 12px" }}>
            {lang === "en" ? "Upload Again" : "Yeniden Yükle"}
          </button>
        )}
      </div>

      {step === "idle" && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void handleFiles(e.dataTransfer.files); }}
          style={{
            border: "2px dashed var(--color-border)", borderRadius: "var(--radius-lg)",
            padding: "40px 24px", textAlign: "center", cursor: "pointer",
            transition: "border-color 0.2s", background: "var(--color-bg)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
        >
          {parsing ? (
            <><div className="spinner" style={{ margin: "0 auto 12px" }} /><p>{lang === "en" ? "Reading PDFs..." : "PDF'ler okunuyor..."}</p></>
          ) : (
            <>
              <div style={{ fontSize: "36px", marginBottom: "8px" }}>📄</div>
              <p style={{ fontWeight: 600, marginBottom: "4px" }}>{lang === "en" ? "Drag PDF files here or click" : "PDF dosyalarını sürükleyin veya tıklayın"}</p>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{lang === "en" ? "You can select multiple files" : "Birden fazla dosya seçebilirsiniz"}</p>
            </>
          )}
          <input ref={inputRef} type="file" accept=".pdf" multiple hidden
            onChange={(e) => void handleFiles(e.target.files)} />
        </div>
      )}

      {step === "review" && rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
          {rows.map((row, i) => (
            <div key={i} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
              {/* Başlık — dosya adı + PDF'ten okunan referans bilgileri */}
              <div style={{ padding: "12px 16px", background: "var(--color-bg)", borderBottom: "1px solid var(--color-border)", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-muted)" }}>📄 {row.fileName}</span>
                {row.invoiceNo && (
                  <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "var(--radius-sm)", background: "rgba(99,102,241,0.1)", color: "#6366f1", fontWeight: 600 }}>
                    No: {row.invoiceNo}
                  </span>
                )}
                {row.eczaneName && (
                  <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>🏥 {row.eczaneName}</span>
                )}
                {row.periodStart && row.periodEnd && (
                  <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                    📅 {lang === "en" ? "Period:" : "Dönem:"} {row.periodStart} — {row.periodEnd}
                  </span>
                )}
                {row.amount === null && (
                  <span style={{ fontSize: "11px", color: "var(--color-danger)", fontWeight: 600 }}>⚠️ {lang === "en" ? "Amount not read" : "Tutar okunamadı"}</span>
                )}
              </div>

              {/* Düzenlenebilir alanlar */}
              <div className="responsive-grid responsive-grid-4-cols" style={{ padding: "16px", gap: "12px", alignItems: "end" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {lang === "en" ? "Invoice Date" : "Fatura Tarihi"}
                  </label>
                  <SingleDatePicker value={row.invoiceDate}
                    onChange={(date) => updateRow(i, "invoiceDate", date)}
                    lang={lang} />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {lang === "en" ? "Invoice Type" : "Fatura Türü"}
                  </label>
                  <select value={row.invoiceType}
                    onChange={(e) => updateRow(i, "invoiceType", e.target.value)}
                    style={{ width: "100%", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "6px 10px", fontSize: "13px", background: "var(--color-bg)" }}>
                    {SGK_INVOICE_TYPES.filter(t => t.value && !t.disabled).map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {lang === "en" ? "Amount (₺)" : "Tutar (₺)"}
                  </label>
                  <input type="number" step="0.01" min="0"
                    value={row.amount ?? ""}
                    onChange={(e) => updateRow(i, "amount", parseFloat(e.target.value) || 0)}
                    style={{ width: "100%", border: `1px solid ${row.amount === null ? "var(--color-danger)" : "var(--color-border)"}`, borderRadius: "var(--radius-sm)", padding: "6px 10px", fontSize: "13px", fontWeight: 700, textAlign: "right", background: "var(--color-bg)" }} />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {lang === "en" ? "Notes" : "Notlar"}
                  </label>
                  <input type="text" value={row.notes}
                    onChange={(e) => updateRow(i, "notes", e.target.value)}
                    placeholder={row.invoiceNo ? `${lang === "en" ? "Invoice No:" : "Fatura No:"} ${row.invoiceNo}` : (lang === "en" ? "Optional..." : "İsteğe bağlı...")}
                    style={{ width: "100%", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "6px 10px", fontSize: "13px", background: "var(--color-bg)" }} />
                </div>
              </div>
            </div>
          ))}

          {/* Onay kutusu */}
          <div style={{ padding: "var(--spacing-5)", borderRadius: "var(--radius-lg)", background: "rgba(78,124,63,0.06)", border: "1px solid rgba(78,124,63,0.2)" }}>
            <p style={{ fontWeight: 600, marginBottom: "var(--spacing-2)", fontSize: "var(--font-size-sm)" }}>
              ✅ {rows.length} {lang === "en" ? "invoices read. Have you reviewed the data?" : "fatura okundu. Verileri kontrol ettiniz mi?"}
            </p>
            <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--spacing-4)" }}>
              {lang === "en" ? "You can edit the fields above. After confirming, all invoices will be saved to the system." : "Yukarıdaki alanları düzenleyebilirsiniz. Onayladıktan sonra tüm faturalar sisteme kaydedilecektir."}
            </p>
            <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
              <button onClick={reset} className="btn" style={{ border: "1px solid var(--color-border)" }}>
                ✕ {lang === "en" ? "Cancel" : "İptal Et"}
              </button>
              <button onClick={() => void handleConfirm()} disabled={saving || rows.some(r => !r.amount)}
                className="btn btn-primary" style={{ flex: 1 }}>
                {saving ? (lang === "en" ? "Saving..." : "Kaydediliyor...") : `✔ ${lang === "en" ? `Confirm and Save ${rows.length} Invoices` : `Onayla ve ${rows.length} Faturayı Kaydet`}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "done" && (
        <div style={{ textAlign: "center", padding: "32px", color: "var(--color-success)" }}>
          <div style={{ fontSize: "40px", marginBottom: "8px" }}>✅</div>
          <p style={{ fontWeight: 700 }}>{lang === "en" ? "Invoices saved successfully!" : "Faturalar başarıyla kaydedildi!"}</p>
          <button onClick={reset} className="btn" style={{ marginTop: "12px" }}>{lang === "en" ? "Upload New" : "Yeni Yükle"}</button>
        </div>
      )}
    </div>
  );
}

const TH: React.CSSProperties = { padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "10px 10px", verticalAlign: "middle" };

// Tam SGK fatura türü listesi
const SGK_INVOICE_TYPES = [
  { value: "GROUP_A", label: "A Grubu" },
  { value: "GROUP_B", label: "B Grubu" },
  { value: "GROUP_C", label: "C Grubu" },
  { value: "", label: "── Sıralı Dağıtım Reçete Grupları ──", disabled: true },
  { value: "SEQ_MOR_TURUNCU",  label: "1. Mor / Turuncu Reçete" },
  { value: "SEQ_ISYERI",       label: "2. İşyeri Hekimi Reçetesi" },
  { value: "SEQ_DIYALIZ",      label: "3. Diyaliz" },
  { value: "SEQ_ORGAN_NAKLI",  label: "4. Organ Nakli" },
  { value: "SEQ_ONKOLOJI",     label: "5. Onkoloji (Kanser)" },
  { value: "SEQ_PSIKIYATRI",   label: "6. Psikiyatri" },
  { value: "SEQ_YASLI_BAKIM",  label: "7. Yaşlılara Yönelik Bakım" },
  { value: "SEQ_PALYATIF",     label: "8. Palyatif Bakım" },
  { value: "SEQ_EVDE_SAGLIK",  label: "9. Evde Sağlık Hizmetleri" },
  { value: "SEQ_FIZIK_TEDAVI", label: "10. Fizik Tedavi & Rehabilitasyon" },
  { value: "SEQ_YOL_GIDERI",   label: "11. Yol Gideri Reçetesi" },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  SGK_INVOICE_TYPES.filter(t => t.value).map(t => [t.value, t.label])
);

function InvoiceTypeSelect({ value, onChange, name }: { value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; name: string }) {
  return (
    <select className="form-input" name={name} value={value} onChange={onChange} required>
      {SGK_INVOICE_TYPES.map((t, i) =>
        t.disabled ? (
          <option key={i} value="" disabled style={{ fontStyle: "italic", color: "gray" }}>
            {t.label}
          </option>
        ) : (
          <option key={t.value} value={t.value}>{t.label}</option>
        )
      )}
    </select>
  );
}

function getTypeLabel(type: string): string {
  if (TYPE_LABEL[type]) return TYPE_LABEL[type];
  const up = type.toUpperCase().replace(/[\s-]/g, "_");
  if (TYPE_LABEL[up]) return TYPE_LABEL[up];
  if (up === "GROUP" || up === "GRUP" || up === "A" || up.includes("GROUP_A") || up.includes("GRUBU_A") || up.includes("A_GRUP")) return "A Grubu";
  if (up === "B" || up.includes("GROUP_B") || up.includes("GRUBU_B") || up.includes("B_GRUP")) return "B Grubu";
  if (up === "C" || up.includes("GROUP_C") || up.includes("GRUBU_C") || up.includes("C_GRUP")) return "C Grubu";
  for (const [k, v] of Object.entries(TYPE_LABEL)) {
    if (k.toUpperCase() === up) return v;
    if (v.toUpperCase() === type.toUpperCase()) return v;
  }
  return type;
}

type SgkInvoice = {
  id: string;
  invoiceDate: string;
  invoiceType: string;
  amount: number;
  expectedPaymentDate: string;
  notes?: string;
};

const emptyForm = {
  invoiceDate: new Date().toISOString().split("T")[0],
  invoiceType: "GROUP_A",
  amount: "",
  notes: "",
};

export default function SgkFaturaPage() {
  const { lang } = useLangContext();
  const [invoices, setInvoices] = useState<SgkInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(emptyForm);

  const [editRecord, setEditRecord] = useState<SgkInvoice | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [histStart, setHistStart] = useState("");
  const [histEnd, setHistEnd] = useState("");

  const fetchInvoices = async () => {
    try {
      const res = await fetch("/api/v1/finans/sgk-fatura", { headers: { "Accept-Language": lang } });
      const json = await res.json();
      if (json.success) setInvoices(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Async veri çekimi — setState await sonrası çalışır, senkron değildir.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchInvoices(); }, []);

  // Tarih + 3 ay önizlemesi — her zaman o ayın 15'i
  const dateLocale = lang === "en" ? enUS : tr;

  const toPaymentDate = (dateStr: string): Date => {
    const d = new Date(dateStr + "T00:00:00");
    const pm = addMonths(new Date(d.getFullYear(), d.getMonth(), 1), 3);
    return new Date(pm.getFullYear(), pm.getMonth(), 15);
  };

  const previewPaymentDate = formData.invoiceDate
    ? format(toPaymentDate(formData.invoiceDate), "dd MMMM yyyy", { locale: dateLocale })
    : "—";

  const editPreviewDate = editForm.invoiceDate
    ? format(toPaymentDate(editForm.invoiceDate), "dd MMMM yyyy", { locale: dateLocale })
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
      const res = await fetch("/api/v1/finans/sgk-fatura", {
        method: "POST",
        headers: { "Content-Type": "application/json" , "Accept-Language": lang },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
      setFormData(emptyForm);
      await fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (inv: SgkInvoice) => {
    setEditRecord(inv);
    setEditForm({
      invoiceDate: new Date(inv.invoiceDate).toISOString().split("T")[0],
      invoiceType: inv.invoiceType,
      amount: String(inv.amount),
      notes: inv.notes || "",
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
      const res = await fetch(`/api/v1/finans/sgk-fatura/${editRecord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" , "Accept-Language": lang },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
      setEditRecord(null);
      await fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/v1/finans/sgk-fatura/${deleteId}`, { method: "DELETE", headers: { "Accept-Language": lang } });
      if (!res.ok) throw new Error(lang === "en" ? "Delete operation failed" : "Silme işlemi başarısız");
      setDeleteId(null);
      await fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const fmt = (v: number) => Number(v).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });

  const nowM = new Date();
  const thisMonthInvoices = invoices.filter(r => {
    const d = new Date(r.invoiceDate);
    return d.getMonth() === nowM.getMonth() && d.getFullYear() === nowM.getFullYear();
  });
  const historyInvoices = invoices.filter(r => {
    const d = r.invoiceDate.substring(0, 10);
    if (histStart && d < histStart) return false;
    if (histEnd && d > histEnd) return false;
    return true;
  });

  return (
    <div style={{ padding: "var(--spacing-8)", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "var(--spacing-6)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700 }}>{tx(t.sgk.title, lang)}</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "14px", marginTop: "4px" }}>
          {lang === "en" ? "Enter SGK invoices. Payment date is automatically calculated 3 months after the invoice date." : "SGK faturalarını sisteme girin. Ödeme tarihi fatura tarihinden 3 ay sonra otomatik hesaplanır."}
        </p>
      </div>

      {/* PDF yükleme bileşeni */}
      <PdfUploadReview
        onSaved={() => { void fetchInvoices(); }}
        onError={(msg) => setError(msg)}
      />

      {error && (
        <div style={{ padding: "12px 16px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "24px", fontSize: "14px" }}>
          {error}
          <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div className="responsive-grid form-list-grid" style={{ gap: "var(--spacing-8)", alignItems: "start" }}>
        {/* FORM */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-5)" }}>
            {lang === "en" ? "📋 Add New Invoice" : "📋 Yeni Fatura Ekle"}
          </h2>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <div className="form-group">
              <label className="form-label">{lang === "en" ? "Invoice Date" : "Fatura Tarihi"}</label>
              <SingleDatePicker value={formData.invoiceDate} onChange={(date) => setFormData(prev => ({ ...prev, invoiceDate: date }))} lang={lang} required />
            </div>

            <div className="form-group">
              <label className="form-label">{lang === "en" ? "Invoice Type" : "Fatura Türü"}</label>
              <InvoiceTypeSelect value={formData.invoiceType} onChange={handleChange} name="invoiceType" />
            </div>

            <div className="form-group">
              <label className="form-label">{lang === "en" ? "Invoice Amount (₺)" : "Fatura Tutarı (₺)"}</label>
              <input type="number" step="0.01" min="0.01" className="form-input" name="amount" value={formData.amount} onChange={handleChange} required placeholder="0,00" />
            </div>

            {/* Otomatik ödeme tarihi önizlemesi */}
            <div style={{
              padding: "14px 16px",
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.05))",
              border: "1px solid rgba(16,185,129,0.25)",
            }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-success)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                📅 {lang === "en" ? "Est. Payment Date (+3 Mo)" : "Tahmini Ödeme Tarihi (+3 Ay)"}
              </p>
              <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-success)" }}>
                {previewPaymentDate}
              </p>
              <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>
                {lang === "en" ? 'This amount is added to "Expected Income" 3 months after the invoice date.' : 'Bu tutar, fatura tarihinden 3 ay sonra "Yatacak Gelirler" hanesine eklenir.'}
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">{lang === "en" ? "Notes" : "Notlar"}</label>
              <textarea className="form-input" name="notes" value={formData.notes} onChange={handleChange} rows={2} placeholder={lang === "en" ? "Optional..." : "İsteğe bağlı..."} />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? (lang === "en" ? "Saving..." : "Kaydediliyor...") : (lang === "en" ? "+ Add Invoice" : "+ Fatura Ekle")}
            </button>
          </form>
        </div>

        {/* BU AY */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-4)" }}>
            <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600 }}>{lang === "en" ? "This Month" : "Bu Ay"}</h2>
            <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
              {thisMonthInvoices.length} {lang === "en" ? "records" : "kayıt"}
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}><div className="spinner" /></div>
          ) : thisMonthInvoices.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-text-muted)" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🏥</div>
              {lang === "en" ? "No invoices for this month." : "Bu ay için fatura bulunamadı."}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table" style={{ width: "100%", fontSize: "14px" }}>
                <thead>
                  <tr>
                    <th>{lang === "en" ? "Invoice Date" : "Fatura Tarihi"}</th>
                    <th>{lang === "en" ? "Type" : "Tür"}</th>
                    <th style={{ textAlign: "right" }}>{lang === "en" ? "Amount" : "Tutar"}</th>
                    <th>{lang === "en" ? "Payment Date" : "Yatacak Tarih"}</th>
                    <th style={{ textAlign: "center" }}>{lang === "en" ? "Actions" : "İşlem"}</th>
                  </tr>
                </thead>
                <tbody>
                  {thisMonthInvoices.map(inv => {
                    const isUpcoming = new Date(inv.expectedPaymentDate) > new Date();
                    return (
                      <tr key={inv.id}>
                        <td>{format(new Date(inv.invoiceDate), "dd MMM yyyy", { locale: dateLocale })}</td>
                        <td>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "12px",
                            fontWeight: 600,
                            background: inv.invoiceType.startsWith("GROUP_") ? "var(--color-primary-light)" : "rgba(139,92,246,0.1)",
                            color: inv.invoiceType.startsWith("GROUP_") ? "var(--color-on-primary-light)" : "var(--color-accent-purple)",
                          }}>
                            {getTypeLabel(inv.invoiceType)}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(Number(inv.amount))}</td>
                        <td>
                          <span style={{ color: isUpcoming ? "var(--color-success)" : "var(--color-text-muted)", fontWeight: isUpcoming ? 600 : 400 }}>
                            {format(new Date(inv.expectedPaymentDate), "dd MMM yyyy", { locale: dateLocale })}
                          </span>
                          {isUpcoming && (
                            <span style={{ marginLeft: "6px", fontSize: "11px", color: "var(--color-success)" }}>
                              ({lang === "en" ? "pending" : "bekliyor"})
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                            <button
                              onClick={() => openEdit(inv)}
                              style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "none", background: "var(--color-primary)", cursor: "pointer", fontSize: "12px", color: "white", fontWeight: 500 }}
                            >
                              {lang === "en" ? "Edit" : "Düzenle"}
                            </button>
                            <button
                              onClick={() => setDeleteId(inv.id)}
                              style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-danger)", background: "transparent", cursor: "pointer", fontSize: "12px", color: "var(--color-danger)" }}
                            >
                              🗑️ {lang === "en" ? "Delete" : "Sil"}
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
              {historyInvoices.length} {lang === "en" ? "records" : "kayıt"}
            </span>
          </div>
        </div>
        <div className="table-wrapper" style={{ maxHeight: "480px", overflowY: "auto" }}>
          {historyInvoices.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--color-text-muted)" }}>
              {lang === "en" ? "No records found." : "Kayıt bulunamadı."}
            </div>
          ) : (
            <table className="table" style={{ width: "100%", fontSize: "14px" }}>
              <thead>
                <tr>
                  <th>{lang === "en" ? "Invoice Date" : "Fatura Tarihi"}</th>
                  <th>{lang === "en" ? "Type" : "Tür"}</th>
                  <th style={{ textAlign: "right" }}>{lang === "en" ? "Amount" : "Tutar"}</th>
                  <th>{lang === "en" ? "Payment Date" : "Yatacak Tarih"}</th>
                  <th style={{ textAlign: "center" }}>{lang === "en" ? "Actions" : "İşlem"}</th>
                </tr>
              </thead>
              <tbody>
                {historyInvoices.map(inv => {
                  const isUpcoming = new Date(inv.expectedPaymentDate) > new Date();
                  return (
                    <tr key={inv.id}>
                      <td>{format(new Date(inv.invoiceDate), "dd MMM yyyy", { locale: dateLocale })}</td>
                      <td>
                        <span style={{
                          padding: "3px 8px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "12px",
                          fontWeight: 600,
                          background: inv.invoiceType.startsWith("GROUP_") ? "var(--color-primary-light)" : "rgba(139,92,246,0.1)",
                          color: inv.invoiceType.startsWith("GROUP_") ? "var(--color-on-primary-light)" : "var(--color-accent-purple)",
                        }}>
                          {getTypeLabel(inv.invoiceType)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(Number(inv.amount))}</td>
                      <td>
                        <span style={{ color: isUpcoming ? "var(--color-success)" : "var(--color-text-muted)", fontWeight: isUpcoming ? 600 : 400 }}>
                          {format(new Date(inv.expectedPaymentDate), "dd MMM yyyy", { locale: dateLocale })}
                        </span>
                        {isUpcoming && (
                          <span style={{ marginLeft: "6px", fontSize: "11px", color: "var(--color-success)" }}>
                            ({lang === "en" ? "pending" : "bekliyor"})
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                          <button
                            onClick={() => openEdit(inv)}
                            style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "none", background: "var(--color-primary)", cursor: "pointer", fontSize: "12px", color: "white", fontWeight: 500 }}
                          >
                            {lang === "en" ? "Edit" : "Düzenle"}
                          </button>
                          <button
                            onClick={() => setDeleteId(inv.id)}
                            style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-danger)", background: "transparent", cursor: "pointer", fontSize: "12px", color: "var(--color-danger)" }}
                          >
                            🗑️ {lang === "en" ? "Delete" : "Sil"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* EDIT MODAL */}
      {editRecord && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>
              {lang === "en" ? "Edit SGK Invoice" : "SGK Faturasını Düzenle"}
            </h3>
            <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Invoice Date" : "Fatura Tarihi"}</label>
                <SingleDatePicker value={editForm.invoiceDate} onChange={(date) => setEditForm(prev => ({ ...prev, invoiceDate: date }))} lang={lang} required />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Invoice Type" : "Fatura Türü"}</label>
                <InvoiceTypeSelect value={editForm.invoiceType} onChange={handleEditChange} name="invoiceType" />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Amount (₺)" : "Tutar (₺)"}</label>
                <input type="number" step="0.01" min="0.01" className="form-input" name="amount" value={editForm.amount} onChange={handleEditChange} required />
              </div>
              <div style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", fontSize: "13px" }}>
                📅 {lang === "en" ? "New Payment Date:" : "Yeni Ödeme Tarihi:"} <strong style={{ color: "var(--color-success)" }}>{editPreviewDate}</strong>
              </div>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Notes" : "Notlar"}</label>
                <textarea className="form-input" name="notes" value={editForm.notes} onChange={handleEditChange} rows={2} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <button type="button" className="btn" onClick={() => setEditRecord(null)} style={{ border: "1px solid var(--color-border)" }}>{lang === "en" ? "Cancel" : "İptal"}</button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? (lang === "en" ? "Updating..." : "Güncelleniyor...") : (lang === "en" ? "Update" : "Güncelle")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "380px" }}>
            <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "12px" }}>{lang === "en" ? "Confirm Delete" : "Silmeyi Onayla"}</h3>
            <p style={{ color: "var(--color-text-muted)", fontSize: "14px", marginBottom: "24px" }}>
              {lang === "en" ? "This SGK invoice will be deleted. This action cannot be undone." : "Bu SGK faturası silinecek. Bu işlem geri alınamaz."}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <button className="btn" onClick={() => setDeleteId(null)} style={{ border: "1px solid var(--color-border)" }}>{lang === "en" ? "Cancel" : "İptal"}</button>
              <button className="btn" onClick={handleDelete} disabled={deleteSubmitting}
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
