"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import type { ColumnMap } from "@/app/api/v1/satis/parse/route";

interface ParsedRow {
  productGroup: string;
  productName: string;
  saleDate: string;
  price: number;
  discountAmount: number;
  saleType: "PRESCRIPTION" | "RETAIL";
  quantity: number;
}

interface SaleRecord extends ParsedRow { id: string }

interface SaleSummary {
  totalRecords: number;
  totalRevenue: number;
  prescriptionCount: number;
  retailCount: number;
  prescriptionRevenue: number;
  retailRevenue: number;
  byGroup: Record<string, number>;
}

const fmt = (v: number) => v.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });

const badge = (t: string) => ({
  PRESCRIPTION: { bg: "#e8f5e9", color: "#2e7d32", label: "Reçeteli" },
  RETAIL: { bg: "#e3f2fd", color: "#1565c0", label: "Perakende" },
}[t] ?? { bg: "#f5f5f5", color: "#555", label: t });

// Şüpheli fiyat uyarısı — "Tutar" kolonu seçildiyse büyük ihtimalle toplam tutar
const SUSPICIOUS_PRICE_COLS = ["tutar", "net tutar", "toplam", "total", "amount"];

export default function SatisRaporPage() {
  const [tab, setTab] = useState<"upload" | "list">("list");

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // List state — UTC dönüşümü olmadan yerel tarih string'i
  const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const now = new Date();
  const [startDate, setStartDate] = useState(toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [endDate, setEndDate] = useState(toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [filterType, setFilterType] = useState<"" | "PRESCRIPTION" | "RETAIL">("");
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [summary, setSummary] = useState<SaleSummary | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const fetchRecords = useCallback(async () => {
    setListLoading(true);
    try {
      const p = new URLSearchParams({ start: startDate, end: endDate });
      if (filterType) p.set("type", filterType);
      const res = await fetch(`/api/v1/satis?${p}`);
      const json = await res.json() as { success: boolean; data?: { records: SaleRecord[]; summary: SaleSummary } };
      if (json.success && json.data) { setRecords(json.data.records); setSummary(json.data.summary); }
    } catch { /* silent */ } finally { setListLoading(false); }
  }, [startDate, endDate, filterType]);

  useEffect(() => { void fetchRecords(); }, [fetchRecords]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setParseError(""); setPreviewRows([]); setColumnMap(null); setSaveSuccess(false); }
  };

  const handleParse = async () => {
    if (!file) return;
    setParsing(true); setParseError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/satis/parse", { method: "POST", body: fd });
      const json = await res.json() as { success: boolean; data?: { rows: ParsedRow[]; columnMap: ColumnMap }; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Dosya okunamadı");
      setPreviewRows(json.data!.rows);
      setColumnMap(json.data!.columnMap ?? null);
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally { setParsing(false); }
  };

  const handleConfirm = async () => {
    setSaving(true); setParseError("");
    try {
      const res = await fetch("/api/v1/satis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: previewRows }),
      });
      const json = await res.json() as { success: boolean; count?: number; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Kayıt başarısız");
      setPreviewRows([]); setFile(null); setColumnMap(null); setSaveSuccess(true);
      await fetchRecords();
      setTab("list");
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/v1/satis/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      await fetchRecords();
    } catch { /* silent */ } finally { setDeleting(false); }
  };

  const handleClearAll = async () => {
    if (!confirm("Tüm satış kayıtları silinecek. Emin misiniz?")) return;
    setClearingAll(true);
    try {
      await fetch("/api/v1/satis/clear-all", { method: "DELETE" });
      await fetchRecords();
    } catch { /* silent */ } finally { setClearingAll(false); }
  };

  const suspiciousPriceCol = columnMap && SUSPICIOUS_PRICE_COLS.some(s => columnMap.price.toLowerCase().includes(s));
  const previewRevenue = previewRows.reduce((s, r) => s + r.price * r.quantity - r.discountAmount, 0);

  return (
    <div style={{ padding: "var(--spacing-8)", maxWidth: "1400px", margin: "0 auto" }}>

      {/* Başlık + Sekmeler */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--spacing-6)", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700 }}>Satış Raporları</h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: "4px" }}>CSV / Excel / PDF dosyasından satışları içe aktarın</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {(["list", "upload"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="btn"
              style={{ background: tab === t ? "var(--color-primary)" : "var(--color-surface)", color: tab === t ? "white" : "var(--color-text)", border: "1px solid var(--color-border)", fontWeight: 600, fontSize: "13px" }}>
              {t === "list" ? "📋 Satış Listesi" : "📤 Dosya İçe Aktar"}
            </button>
          ))}
        </div>
      </div>

      {saveSuccess && (
        <div style={{ marginBottom: "var(--spacing-4)", padding: "12px 16px", background: "#e8f5e9", color: "#2e7d32", borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: "14px" }}>
          ✅ Satışlar başarıyla kaydedildi.
        </div>
      )}

      {/* ── DOSYA İÇE AKTAR ── */}
      {tab === "upload" && (
        <div style={{ maxWidth: "700px" }}>
          <div className="card">
            <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "var(--spacing-2)" }}>Satış Dosyası Yükle</h2>
            <p style={{ color: "var(--color-text-muted)", fontSize: "14px", marginBottom: "var(--spacing-4)" }}>
              Desteklenen: <strong>Excel (.xlsx, .xls)</strong>, <strong>CSV</strong>, <strong>PDF</strong>
            </p>

            {/* Tek upload alanı */}
            <label htmlFor="sale-file-input" style={{
              display: "block", border: "2px dashed var(--color-border)", borderRadius: "var(--radius-lg)",
              padding: "36px", textAlign: "center", background: "var(--color-bg)",
              cursor: "pointer", marginBottom: "var(--spacing-4)", transition: "border-color 0.2s",
            }}>
              <div style={{ fontSize: "44px", marginBottom: "10px" }}>{file ? "📄" : "📊"}</div>
              <p style={{ fontWeight: 600, fontSize: "15px", marginBottom: "4px" }}>
                {file ? file.name : "Dosya seçmek için tıklayın"}
              </p>
              {file
                ? <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>{(file.size / 1024 / 1024).toFixed(2)} MB · Farklı dosya seçmek için tekrar tıklayın</p>
                : <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>xlsx · xls · csv · pdf</p>
              }
              <input id="sale-file-input" type="file" accept=".csv,.xlsx,.xls,.pdf"
                style={{ display: "none" }} onChange={handleFilePick} />
            </label>

            {/* Beklenen kolonlar */}
            <div style={{ padding: "14px", background: "var(--color-bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", marginBottom: "var(--spacing-4)", fontSize: "13px" }}>
              <p style={{ fontWeight: 600, marginBottom: "8px" }}>Desteklenen Sütun Adları:</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", color: "var(--color-text-muted)" }}>
                <span><strong>Fiyat:</strong> Birim Fiyat, Fiyat, Liste Fiyatı</span>
                <span><strong>Adet:</strong> Adet, Miktar, Quantity</span>
                <span><strong>İskonto:</strong> İskonto, İskonto %, İskonto Tutarı</span>
                <span><strong>Tarih:</strong> Tarih, Satış Tarihi, Date</span>
                <span><strong>Ürün:</strong> Ürün Adı, Stok Adı, İlaç Adı</span>
                <span><strong>Tip:</strong> Reçeteli / Perakende / SGK</span>
              </div>
              <p style={{ marginTop: "8px", color: "var(--color-warning, #b45309)", fontSize: "12px" }}>
                ⚠ Dosyanızda <strong>Tutar</strong> veya <strong>Net Tutar</strong> sütunu varsa bu toplam tutardır, birim fiyat değildir. <strong>Birim Fiyat</strong> sütununuzu kullanın.
              </p>
            </div>

            {parseError && (
              <div style={{ padding: "12px", background: "var(--color-danger-bg, #fee2e2)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "16px", fontSize: "14px" }}>
                ❌ {parseError}
              </div>
            )}

            <button className="btn btn-primary btn-full" disabled={!file || parsing} onClick={() => void handleParse()}>
              {parsing ? "Dosya Okunuyor..." : "Dosyayı Oku ve Önizle"}
            </button>
          </div>

          {/* Önizleme */}
          {previewRows.length > 0 && (
            <div style={{ marginTop: "var(--spacing-5)" }}>

              {/* Kolon haritası uyarısı */}
              {columnMap && (
                <div style={{
                  marginBottom: "var(--spacing-4)", padding: "14px 16px",
                  background: suspiciousPriceCol ? "#fff7ed" : "#f0fdf4",
                  border: `1px solid ${suspiciousPriceCol ? "#fed7aa" : "#bbf7d0"}`,
                  borderRadius: "var(--radius-md)", fontSize: "13px",
                }}>
                  <p style={{ fontWeight: 700, marginBottom: "8px", color: suspiciousPriceCol ? "#b45309" : "#166534" }}>
                    {suspiciousPriceCol ? "⚠ Fiyat Kolonu Şüpheli — Kontrol Edin" : "✅ Algılanan Sütun Eşleşmesi"}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px 16px", color: "var(--color-text-muted)" }}>
                    <span>Fiyat: <strong style={{ color: suspiciousPriceCol ? "#b45309" : "inherit" }}>{columnMap.price}</strong></span>
                    <span>Adet: <strong>{columnMap.quantity}</strong></span>
                    <span>İskonto: <strong>{columnMap.discount}</strong></span>
                    <span>Ürün: <strong>{columnMap.name}</strong></span>
                    <span>Tarih: <strong>{columnMap.date}</strong></span>
                    <span>Tip: <strong>{columnMap.type}</strong></span>
                  </div>
                  {suspiciousPriceCol && (
                    <p style={{ marginTop: "8px", color: "#b45309", fontWeight: 500 }}>
                      "<strong>{columnMap.price}</strong>" sütunu birim fiyat değil, toplam tutar olabilir. Bu durumda ciro çok büyük çıkacaktır. Excel dosyanızda "Birim Fiyat" sütunu ekleyin veya doğru sütun adını kullanın.
                    </p>
                  )}
                </div>
              )}

              {/* Özet kartları */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--spacing-3)", marginBottom: "var(--spacing-4)" }}>
                {[
                  { label: "Toplam Satır", value: `${previewRows.length} Kayıt` },
                  { label: "Reçeteli", value: `${previewRows.filter(r => r.saleType === "PRESCRIPTION").length} Kayıt` },
                  { label: "Perakende", value: `${previewRows.filter(r => r.saleType === "RETAIL").length} Kayıt` },
                  { label: "Tahmini Ciro", value: fmt(previewRevenue) },
                ].map(c => (
                  <div key={c.label} className="card" style={{ padding: "var(--spacing-3)" }}>
                    <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>{c.label}</div>
                    <div style={{ fontSize: "var(--font-size-base)", fontWeight: 700 }}>{c.value}</div>
                  </div>
                ))}
              </div>

              {/* Aksiyon butonları */}
              <div style={{ display: "flex", gap: "var(--spacing-3)", marginBottom: "var(--spacing-4)" }}>
                <button className="btn" onClick={() => { setPreviewRows([]); setFile(null); setColumnMap(null); }}>
                  ← İptal Et
                </button>
                <button className="btn btn-primary" disabled={saving || suspiciousPriceCol === true} onClick={() => void handleConfirm()} style={{ minWidth: "220px" }}>
                  {saving ? "Kaydediliyor..." : `${previewRows.length} Satışı Onayla ve Kaydet`}
                </button>
                {suspiciousPriceCol && (
                  <span style={{ alignSelf: "center", fontSize: "13px", color: "#b45309" }}>
                    ⚠ Şüpheli fiyat sütunu — Önce dosyayı düzeltin
                  </span>
                )}
              </div>

              {/* Önizleme tablosu */}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--color-border)", fontWeight: 700, fontSize: "14px" }}>
                  Önizleme — İlk 50 satır gösteriliyor
                </div>
                <div style={{ overflowX: "auto", maxHeight: "480px", overflowY: "auto" }}>
                  <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                    <thead style={{ position: "sticky", top: 0, background: "var(--color-surface)" }}>
                      <tr>
                        <th>#</th><th>Ürün Grubu</th><th>Ürün Adı</th><th>Tarih</th>
                        <th>Adet</th><th>Birim Fiyat</th><th>İskonto</th><th>Net Tutar</th><th>Tip</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 50).map((row, i) => {
                        const b = badge(row.saleType);
                        const net = row.price * row.quantity - row.discountAmount;
                        return (
                          <tr key={i}>
                            <td style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{i + 1}</td>
                            <td style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{row.productGroup}</td>
                            <td style={{ fontWeight: 500 }}>{row.productName}</td>
                            <td style={{ whiteSpace: "nowrap", fontSize: "12px" }}>{row.saleDate.split("T")[0]}</td>
                            <td>{row.quantity}</td>
                            <td>{row.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                            <td style={{ color: row.discountAmount > 0 ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                              {row.discountAmount > 0 ? `−${row.discountAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "—"}
                            </td>
                            <td style={{ fontWeight: 700 }}>{net.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                            <td>
                              <span style={{ padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 600, background: b.bg, color: b.color }}>
                                {b.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {previewRows.length > 50 && (
                  <div style={{ padding: "10px 18px", color: "var(--color-text-muted)", fontSize: "13px", borderTop: "1px solid var(--color-border)" }}>
                    + {previewRows.length - 50} satır daha (toplamda {previewRows.length} kayıt kaydedilecek)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SATIŞ LİSTESİ ── */}
      {tab === "list" && (
        <div>
          {/* Filtreler */}
          <div className="card" style={{ marginBottom: "var(--spacing-5)", display: "flex", gap: "var(--spacing-4)", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: "var(--spacing-4)", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Başlangıç</label>
                <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: "160px" }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Bitiş</label>
                <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: "160px" }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Satış Tipi</label>
                <select className="form-input" value={filterType} onChange={e => setFilterType(e.target.value as "" | "PRESCRIPTION" | "RETAIL")} style={{ width: "160px" }}>
                  <option value="">Tümü</option>
                  <option value="PRESCRIPTION">Reçeteli</option>
                  <option value="RETAIL">Perakende</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={() => void fetchRecords()} disabled={listLoading}>
                {listLoading ? "Yükleniyor..." : "Filtrele"}
              </button>
            </div>
            {records.length > 0 && (
              <button
                className="btn"
                onClick={() => void handleClearAll()}
                disabled={clearingAll}
                style={{ background: "var(--color-danger)", color: "white", fontSize: "13px" }}
              >
                {clearingAll ? "Siliniyor..." : "🗑 Tüm Kayıtları Temizle"}
              </button>
            )}
          </div>

          {summary && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--spacing-4)", marginBottom: "var(--spacing-5)" }}>
              <div className="card" style={{ padding: "var(--spacing-4)" }}>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>Toplam Ciro</div>
                <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 800, color: "var(--color-primary)" }}>{fmt(summary.totalRevenue)}</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "4px" }}>{summary.totalRecords} satış</div>
              </div>
              <div className="card" style={{ padding: "var(--spacing-4)" }}>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>Reçeteli (SGK)</div>
                <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 700 }}>{fmt(summary.prescriptionRevenue)}</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "4px" }}>{summary.prescriptionCount} satış</div>
              </div>
              <div className="card" style={{ padding: "var(--spacing-4)" }}>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>Perakende (Elden)</div>
                <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 700 }}>{fmt(summary.retailRevenue)}</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "4px" }}>{summary.retailCount} satış</div>
              </div>
            </div>
          )}

          {summary && Object.keys(summary.byGroup).length > 0 && (
            <div className="card" style={{ marginBottom: "var(--spacing-5)", padding: "var(--spacing-4)" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "var(--spacing-3)" }}>Ürün Grubu Dağılımı</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {Object.entries(summary.byGroup).sort(([, a], [, b]) => b - a).map(([group, total]) => (
                  <div key={group} style={{ padding: "8px 14px", borderRadius: "var(--radius-md)", background: "var(--color-bg)", border: "1px solid var(--color-border)", fontSize: "13px" }}>
                    <span style={{ fontWeight: 600 }}>{group}</span>
                    <span style={{ marginLeft: "8px", color: "var(--color-primary)", fontWeight: 700 }}>{fmt(total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", fontWeight: 700, fontSize: "14px" }}>
              Satış Kayıtları ({records.length})
            </div>
            {listLoading ? (
              <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /></div>
            ) : records.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--color-text-muted)", fontSize: "14px" }}>
                Seçilen dönemde satış kaydı bulunamadı.
              </div>
            ) : (
              <div style={{ overflowX: "auto", maxHeight: "520px", overflowY: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--color-surface)" }}>
                    <tr>
                      <th>Tarih</th><th>Ürün Grubu</th><th>Ürün Adı</th>
                      <th>Adet</th><th>Fiyat</th><th>İskonto</th><th>Net</th><th>Tip</th>
                      <th style={{ textAlign: "right" }}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => {
                      const b = badge(r.saleType);
                      const net = r.price * r.quantity - r.discountAmount;
                      return (
                        <tr key={r.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{format(new Date(r.saleDate), "dd MMM yyyy", { locale: tr })}</td>
                          <td style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{r.productGroup}</td>
                          <td style={{ fontWeight: 500 }}>{r.productName}</td>
                          <td>{r.quantity}</td>
                          <td>{r.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                          <td style={{ color: r.discountAmount > 0 ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                            {r.discountAmount > 0 ? `−${r.discountAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td style={{ fontWeight: 700 }}>{net.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                          <td>
                            <span style={{ padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 600, background: b.bg, color: b.color }}>
                              {b.label}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button onClick={() => setDeleteId(r.id)}
                              style={{ padding: "3px 8px", fontSize: "11px", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                              Sil
                            </button>
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
      )}

      {/* Sil Modal */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "380px", padding: "var(--spacing-6)", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🗑️</div>
            <h3 style={{ fontWeight: 700, marginBottom: "8px" }}>Satış Kaydını Sil</h3>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--spacing-5)", fontSize: "14px" }}>Bu satış kaydını silmek istediğinizden emin misiniz?</p>
            <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setDeleteId(null)}>İptal</button>
              <button className="btn" style={{ flex: 1, background: "var(--color-danger)", color: "white" }}
                onClick={() => void handleDelete()} disabled={deleting}>
                {deleting ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
