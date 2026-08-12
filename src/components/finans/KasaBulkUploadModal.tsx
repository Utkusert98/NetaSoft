"use client";

import { useState } from "react";
import type { ParsedKasaRow, KasaColumnMap } from "@/lib/kasa/mapRow";

const fmtTL = (v: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(v);

/**
 * Günlük Kasa (Z-raporu) toplu Excel/CSV yükleme akışı — Satış Raporu'ndaki
 * "yükle → önizle → onayla → kaydet" desenini izler, dosya asla onay
 * ekranından geçmeden veritabanına yazılmaz (AGENTS.md madde 3). Mevcut bir
 * tarihe ait kayıt varsa /bulk endpoint'i o satırı SESSİZCE ATLAR (üzerine
 * yazmaz), sonuçta hangi tarihlerin atlandığı kullanıcıya gösterilir.
 */
export default function KasaBulkUploadModal({
  lang,
  onClose,
  onSaved,
}: {
  lang: "tr" | "en";
  onClose: () => void;
  onSaved: () => void;
}) {
  const en = lang === "en";
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [rows, setRows] = useState<ParsedKasaRow[]>([]);
  const [colMap, setColMap] = useState<KasaColumnMap | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ created: number; skippedDates: string[] } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParsing(true);
    setParseError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/v1/finans/kasa/parse", { method: "POST", body: fd });
      const json = await res.json() as { success: boolean; error?: string; data?: { rows: ParsedKasaRow[]; columnMap: KasaColumnMap | null } };
      if (!res.ok || !json.success || !json.data) {
        setParseError(json.error ?? (en ? "File could not be read." : "Dosya okunamadı."));
        setRows([]);
        return;
      }
      setRows(json.data.rows);
      setColMap(json.data.columnMap);
    } catch {
      setParseError(en ? "Server error, please try again." : "Sunucu hatası, lütfen tekrar deneyin.");
    } finally {
      setParsing(false);
    }
  };

  const validRows = rows.filter(r => !r.dateInvalid);
  const invalidCount = rows.length - validRows.length;

  const handleSave = async () => {
    if (validRows.length === 0) return;
    setSaving(true);
    setParseError("");
    try {
      const res = await fetch("/api/v1/finans/kasa/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({ rows: validRows }),
      });
      const json = await res.json() as { success: boolean; error?: string; data?: { created: number; skippedDates: string[] } };
      if (!res.ok || !json.success || !json.data) {
        setParseError(json.error ?? (en ? "Save failed." : "Kaydetme başarısız oldu."));
        return;
      }
      setResult(json.data);
      onSaved();
    } catch {
      setParseError(en ? "Server error, please try again." : "Sunucu hatası, lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: "640px", maxHeight: "85vh", overflowY: "auto", padding: "var(--spacing-6)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-4)" }}>
          <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700 }}>
            📥 {en ? "Bulk Upload Register Entries (Excel)" : "Kasa Kayıtlarını Toplu Yükle (Excel)"}
          </h3>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "var(--color-text-muted)" }}>✕</button>
        </div>

        {!result && (
          <>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "var(--spacing-4)", lineHeight: 1.6 }}>
              {en
                ? "Upload a CSV/Excel file with columns for Date, POS, Cash, and Wire/EFT (column names are matched flexibly, e.g. \"Tarih\", \"POS\", \"Nakit\", \"Havale\"). Existing dates already recorded will be skipped automatically — nothing gets overwritten."
                : "Tarih, POS, Nakit ve Havale/EFT sütunlarını içeren bir CSV/Excel dosyası yükleyin (sütun adları esnek eşleştirilir, ör. \"Tarih\", \"POS\", \"Nakit\", \"Havale\"). Zaten kaydı olan tarihler otomatik atlanır — hiçbir şeyin üzerine yazılmaz."}
            </p>

            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => void handleFileChange(e)}
              disabled={parsing}
              className="form-input"
              style={{ marginBottom: "var(--spacing-4)" }}
            />

            {parseError && (
              <div style={{ padding: "10px 14px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", fontSize: "13px", marginBottom: "var(--spacing-4)" }}>
                ⚠️ {parseError}
              </div>
            )}

            {parsing && (
              <div style={{ textAlign: "center", padding: "24px" }}><div className="spinner" style={{ margin: "0 auto" }} /></div>
            )}

            {!parsing && rows.length > 0 && (
              <>
                {colMap && (
                  <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "var(--spacing-3)" }}>
                    {en ? "Detected columns:" : "Bulunan sütunlar:"} {en ? "Date" : "Tarih"}={colMap.date}, POS={colMap.pos}, {en ? "Cash" : "Nakit"}={colMap.cash}, {en ? "Wire" : "Havale"}={colMap.wire}
                  </p>
                )}

                {invalidCount > 0 && (
                  <div style={{ padding: "10px 14px", background: "var(--color-warning-bg)", color: "var(--color-warning)", borderRadius: "var(--radius-md)", fontSize: "13px", marginBottom: "var(--spacing-3)" }}>
                    ⚠️ {en
                      ? `${invalidCount} row(s) have an unreadable date and will be skipped.`
                      : `${invalidCount} satırda tarih okunamadı, bu satırlar atlanacak.`}
                  </div>
                )}

                <div style={{ overflowX: "auto", maxHeight: "300px", overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-4)" }}>
                  <table className="table" style={{ width: "100%", fontSize: "12px" }}>
                    <thead>
                      <tr>
                        <th>{en ? "Date" : "Tarih"}</th>
                        <th>POS</th>
                        <th>{en ? "Cash" : "Nakit"}</th>
                        <th>{en ? "Wire" : "Havale"}</th>
                        <th>{en ? "Total" : "Toplam"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} style={r.dateInvalid ? { opacity: 0.5, textDecoration: "line-through" } : undefined}>
                          <td>{r.dateInvalid ? (r.rawDateValue || "—") : new Date(r.registerDate).toLocaleDateString("tr-TR")}</td>
                          <td>{fmtTL(r.posAmount)}</td>
                          <td>{fmtTL(r.cashAmount)}</td>
                          <td>{fmtTL(r.wireAmount)}</td>
                          <td style={{ fontWeight: 700 }}>{fmtTL(r.posAmount + r.cashAmount + r.wireAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
                    {en ? `${validRows.length} valid row(s) will be saved.` : `${validRows.length} geçerli satır kaydedilecek.`}
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={saving || validRows.length === 0}
                    onClick={() => void handleSave()}
                  >
                    {saving ? (en ? "Saving..." : "Kaydediliyor...") : (en ? "Save" : "Kaydet")}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {result && (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
            <p style={{ fontWeight: 700, fontSize: "var(--font-size-lg)", marginBottom: "8px" }}>
              {en ? `${result.created} record(s) saved.` : `${result.created} kayıt kaydedildi.`}
            </p>
            {result.skippedDates.length > 0 && (
              <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "16px" }}>
                {en
                  ? `${result.skippedDates.length} date(s) already had a record and were skipped: ${result.skippedDates.slice(0, 10).join(", ")}${result.skippedDates.length > 10 ? "…" : ""}`
                  : `${result.skippedDates.length} tarihte zaten kayıt vardı, atlandı: ${result.skippedDates.slice(0, 10).join(", ")}${result.skippedDates.length > 10 ? "…" : ""}`}
              </p>
            )}
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {en ? "Done" : "Tamam"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
