"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import type { ParsedSaleRow, ColumnMap, ColumnOverride } from "@/app/api/v1/satis/parse/route";

interface SaleRecord extends ParsedSaleRow { id: string }

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
const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

const badge = (t: string) => ({
  PRESCRIPTION: { bg: "#e8f5e9", color: "#2e7d32", label: "Reçeteli" },
  RETAIL: { bg: "#e3f2fd", color: "#1565c0", label: "Perakende" },
}[t] ?? { bg: "#f5f5f5", color: "#555", label: t });

type UploadStep = "select" | "mapping" | "preview";

export default function SatisRaporPage() {
  const [tab, setTab] = useState<"upload" | "list">("list");

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<UploadStep>("select");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [previewRows, setPreviewRows] = useState<ParsedSaleRow[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [override, setOverride] = useState<ColumnOverride>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // List state
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

  const resetUpload = () => {
    setFile(null); setStep("select"); setParseError("");
    setPreviewRows([]); setColumnMap(null); setHeaders([]);
    setOverride({}); setSaveSuccess(false);
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setParseError(""); setStep("select"); }
  };

  const callParse = async (overrideData: ColumnOverride) => {
    if (!file) return;
    setParsing(true); setParseError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (Object.keys(overrideData).length > 0) {
        fd.append("columnOverride", JSON.stringify(overrideData));
      }
      const res = await fetch("/api/v1/satis/parse", { method: "POST", body: fd });
      const json = await res.json() as {
        success: boolean;
        data?: { rows: ParsedSaleRow[]; columnMap: ColumnMap; headers: string[] };
        error?: string;
      };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Dosya okunamadı");
      setPreviewRows(json.data!.rows);
      setColumnMap(json.data!.columnMap ?? null);
      setHeaders(json.data!.headers ?? []);
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally { setParsing(false); }
  };

  const handleReadFile = async () => {
    await callParse({});
    setStep("mapping");
  };

  const handleApplyMapping = async () => {
    await callParse(override);
    setStep("preview");
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
      resetUpload();
      setSaveSuccess(true);
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

  const totalNetRevenue = previewRows.reduce((s, r) => s + r.netRevenue, 0);

  const effectiveMap = (key: keyof ColumnOverride): string => {
    const ovr = override[key];
    if (ovr !== undefined && typeof ovr === "string") return ovr;
    if (columnMap) {
      const v = columnMap[key as keyof ColumnMap];
      if (typeof v === "string") return v;
    }
    return "";
  };

  const effectiveIsNet = (): boolean => {
    if (override.priceIsNet !== undefined) return override.priceIsNet;
    return columnMap?.priceIsNet ?? false;
  };

  const setOvr = (key: keyof ColumnOverride, val: string | boolean) =>
    setOverride(prev => ({ ...prev, [key]: val }));

  const ColSelect = ({ fieldKey, label, hint }: { fieldKey: keyof ColumnOverride; label: string; hint?: string }) => (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">{label}</label>
      <select className="form-input" value={effectiveMap(fieldKey)}
        onChange={e => setOvr(fieldKey, e.target.value)}>
        <option value="">— Seçilmedi —</option>
        {headers.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      {hint && <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>{hint}</p>}
    </div>
  );

  return (
    <div style={{ padding: "var(--spacing-8)", maxWidth: "1400px", margin: "0 auto" }}>

      {/* Başlık + Sekmeler */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--spacing-6)", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700 }}>Satış Raporları</h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: "4px" }}>Eczane satış verilerini tarih aralığına göre analiz edin</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {(["list", "upload"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="btn"
              style={{ background: tab === t ? "var(--color-primary)" : "var(--color-surface)", color: tab === t ? "white" : "var(--color-text)", border: "1px solid var(--color-border)", fontWeight: 600, fontSize: "13px" }}>
              {t === "list" ? "📋 Satış Listesi" : "📤 Veri Aktar"}
            </button>
          ))}
        </div>
      </div>

      {saveSuccess && (
        <div style={{ marginBottom: "var(--spacing-4)", padding: "12px 16px", background: "#e8f5e9", color: "#2e7d32", borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: "14px" }}>
          ✅ Satışlar başarıyla kaydedildi. Listede görüntüleyebilirsiniz.
        </div>
      )}

      {/* ── DOSYA İÇE AKTAR ── */}
      {tab === "upload" && (
        <div style={{ maxWidth: "800px" }}>

          {/* Adım göstergesi */}
          <div style={{ display: "flex", marginBottom: "var(--spacing-5)", borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--color-border)" }}>
            {([
              { id: "select",  label: "1. Dosya Seç", icon: "📂" },
              { id: "mapping", label: "2. Kolon Eşleştir", icon: "🔧" },
              { id: "preview", label: "3. Onayla & Kaydet", icon: "✅" },
            ] as const).map((s, i, arr) => (
              <div key={s.id} style={{
                flex: 1, padding: "10px 16px", textAlign: "center", fontSize: "13px", fontWeight: 600,
                background: step === s.id ? "var(--color-primary)" : "var(--color-bg)",
                color: step === s.id ? "white" : "var(--color-text-muted)",
                borderRight: i < arr.length - 1 ? "1px solid var(--color-border)" : "none",
              }}>
                {s.icon} {s.label}
              </div>
            ))}
          </div>

          {parseError && (
            <div style={{ padding: "12px", background: "var(--color-danger-bg, #fee2e2)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "16px", fontSize: "14px" }}>
              ❌ {parseError}
            </div>
          )}

          {/* ADIM 1 */}
          {step === "select" && (
            <div className="card">
              <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "var(--spacing-2)" }}>Satış Dosyası Yükle</h2>
              <p style={{ color: "var(--color-text-muted)", fontSize: "14px", marginBottom: "var(--spacing-4)" }}>
                Eczane yazılımından (Logo, Urus, EYS vb.) dışa aktarılan Excel/CSV dosyasını seçin.
              </p>

              <label htmlFor="sale-file-input" style={{
                display: "block", border: "2px dashed var(--color-border)", borderRadius: "var(--radius-lg)",
                padding: "36px", textAlign: "center", background: "var(--color-bg)",
                cursor: "pointer", marginBottom: "var(--spacing-4)",
              }}>
                <div style={{ fontSize: "44px", marginBottom: "10px" }}>{file ? "📄" : "📊"}</div>
                <p style={{ fontWeight: 600, fontSize: "15px", marginBottom: "4px" }}>
                  {file ? file.name : "Dosya seçmek için tıklayın"}
                </p>
                <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "xlsx · xls · csv · pdf"}
                </p>
                <input id="sale-file-input" type="file" accept=".csv,.xlsx,.xls,.pdf"
                  style={{ display: "none" }} onChange={handleFilePick} />
              </label>

              <button className="btn btn-primary btn-full" disabled={!file || parsing} onClick={() => void handleReadFile()}>
                {parsing ? "Dosya Okunuyor..." : "Dosyayı Oku →"}
              </button>
            </div>
          )}

          {/* ADIM 2: Kolon Eşleştirme */}
          {step === "mapping" && columnMap && (
            <div className="card">
              <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "6px" }}>Kolon Eşleştirme</h2>
              <p style={{ color: "var(--color-text-muted)", fontSize: "14px", marginBottom: "var(--spacing-4)" }}>
                Sistem otomatik eşleştirdi. Yanlış alanları düzeltin, sonra &ldquo;Önizlemeye Geç&rdquo;e tıklayın.
              </p>

              {effectiveIsNet() && (
                <div style={{ padding: "12px 14px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-4)", fontSize: "13px" }}>
                  <p style={{ fontWeight: 700, color: "#b45309", marginBottom: "4px" }}>⚠ Net Tutar Modu Aktif</p>
                  <p style={{ color: "#92400e" }}>
                    Seçilen fiyat kolonu zaten toplam geliri içeriyor — adet ile çarpılmayacak. Bu doğruysa devam edin.
                    Birim fiyat kolonunuz varsa aşağıdan değiştirin.
                  </p>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-4)" }}>
                <ColSelect fieldKey="price" label="Fiyat Kolonu *"
                  hint="'Birim Fiyat' = adet × fiyat hesaplanır · 'Tutar/Net Tutar' = zaten toplam" />

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Fiyat Türü</label>
                  <select className="form-input"
                    value={effectiveIsNet() ? "net" : "unit"}
                    onChange={e => setOvr("priceIsNet", e.target.value === "net")}>
                    <option value="unit">Birim Fiyat (Adet × Fiyat hesaplanır)</option>
                    <option value="net">Net Tutar (Zaten toplam, çarpma yapılmaz)</option>
                  </select>
                </div>

                <ColSelect fieldKey="quantity" label="Adet Kolonu" />
                <ColSelect fieldKey="discount" label="İskonto Kolonu" />
                <ColSelect fieldKey="name" label="Ürün Adı Kolonu *" />
                <ColSelect fieldKey="date" label="Tarih Kolonu *" />
                <ColSelect fieldKey="group" label="Ürün Grubu Kolonu" />
                <ColSelect fieldKey="type" label="Satış Tipi Kolonu"
                  hint="Reçeteli/SGK veya Perakende/Elden ayrımı" />
              </div>

              <div style={{ display: "flex", gap: "var(--spacing-3)", marginTop: "var(--spacing-5)" }}>
                <button className="btn" onClick={resetUpload}>← Geri</button>
                <button className="btn btn-primary" disabled={parsing} onClick={() => void handleApplyMapping()}>
                  {parsing ? "Önizleme Hazırlanıyor..." : "Önizlemeye Geç →"}
                </button>
              </div>
            </div>
          )}

          {/* ADIM 3: Önizleme */}
          {step === "preview" && previewRows.length > 0 && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--spacing-3)", marginBottom: "var(--spacing-4)" }}>
                {[
                  { label: "Toplam Kayıt", value: previewRows.length.toLocaleString("tr-TR") },
                  { label: "Reçeteli (SGK)", value: previewRows.filter(r => r.saleType === "PRESCRIPTION").length.toLocaleString("tr-TR") },
                  { label: "Perakende", value: previewRows.filter(r => r.saleType === "RETAIL").length.toLocaleString("tr-TR") },
                  { label: "Toplam Ciro", value: fmt(totalNetRevenue), highlight: true },
                ].map(c => (
                  <div key={c.label} className="card" style={{ padding: "var(--spacing-3)" }}>
                    <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>{c.label}</div>
                    <div style={{ fontSize: c.highlight ? "var(--font-size-lg)" : "var(--font-size-base)", fontWeight: 700, color: c.highlight ? "var(--color-primary)" : undefined }}>{c.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "var(--spacing-3)", marginBottom: "var(--spacing-4)", flexWrap: "wrap" }}>
                <button className="btn" onClick={() => setStep("mapping")}>← Kolonları Düzenle</button>
                <button className="btn btn-primary" disabled={saving} onClick={() => void handleConfirm()} style={{ minWidth: "240px" }}>
                  {saving ? "Kaydediliyor..." : `${previewRows.length.toLocaleString("tr-TR")} Satışı Onayla ve Kaydet`}
                </button>
              </div>

              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--color-border)", fontWeight: 700, fontSize: "14px" }}>
                  Önizleme — İlk 50 Satır
                </div>
                <div style={{ overflowX: "auto", maxHeight: "480px", overflowY: "auto" }}>
                  <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                    <thead style={{ position: "sticky", top: 0, background: "var(--color-surface)" }}>
                      <tr>
                        <th>#</th><th>Tarih</th><th>Ürün Adı</th><th>Grup</th>
                        <th>Adet</th><th>Fiyat</th><th>İskonto</th><th>Net Gelir</th><th>Tip</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 50).map((row, i) => {
                        const b = badge(row.saleType);
                        return (
                          <tr key={i}>
                            <td style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{i + 1}</td>
                            <td style={{ whiteSpace: "nowrap", fontSize: "12px" }}>{row.saleDate.split("T")[0]}</td>
                            <td style={{ fontWeight: 500 }}>{row.productName}</td>
                            <td style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{row.productGroup}</td>
                            <td>{row.quantity}</td>
                            <td>{row.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                            <td style={{ color: row.discountAmount > 0 ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                              {row.discountAmount > 0 ? `−${row.discountAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "—"}
                            </td>
                            <td style={{ fontWeight: 700 }}>{row.netRevenue.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
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
                    + {(previewRows.length - 50).toLocaleString("tr-TR")} satır daha — toplam {previewRows.length.toLocaleString("tr-TR")} kayıt kaydedilecek
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
                  <option value="PRESCRIPTION">Reçeteli (SGK)</option>
                  <option value="RETAIL">Perakende (Elden)</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={() => void fetchRecords()} disabled={listLoading}>
                {listLoading ? "Yükleniyor..." : "Filtrele"}
              </button>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn" onClick={() => { setTab("upload"); setStep("select"); }}
                style={{ border: "1px solid var(--color-primary)", color: "var(--color-primary)", fontWeight: 600, fontSize: "13px" }}>
                📤 Veri Aktar
              </button>
              {records.length > 0 && (
                <button className="btn" onClick={() => void handleClearAll()} disabled={clearingAll}
                  style={{ background: "var(--color-danger)", color: "white", fontSize: "13px" }}>
                  {clearingAll ? "Siliniyor..." : "🗑 Tüm Kayıtları Temizle"}
                </button>
              )}
            </div>
          </div>

          {summary && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--spacing-4)", marginBottom: "var(--spacing-5)" }}>
              <div className="card" style={{ padding: "var(--spacing-4)" }}>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>Toplam Ciro</div>
                <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 800, color: "var(--color-primary)" }}>{fmt(summary.totalRevenue)}</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "4px" }}>{summary.totalRecords.toLocaleString("tr-TR")} satış</div>
              </div>
              <div className="card" style={{ padding: "var(--spacing-4)" }}>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>Reçeteli / SGK</div>
                <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 700 }}>{fmt(summary.prescriptionRevenue)}</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "4px" }}>{summary.prescriptionCount.toLocaleString("tr-TR")} satış</div>
              </div>
              <div className="card" style={{ padding: "var(--spacing-4)" }}>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>Perakende / Elden</div>
                <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 700 }}>{fmt(summary.retailRevenue)}</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "4px" }}>{summary.retailCount.toLocaleString("tr-TR")} satış</div>
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
              Satış Kayıtları{summary ? ` (${summary.totalRecords.toLocaleString("tr-TR")})` : ""}
            </div>
            {listLoading ? (
              <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /></div>
            ) : records.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--color-text-muted)" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>📊</div>
                <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>Seçilen Dönemde Satış Kaydı Yok</p>
                <p style={{ fontSize: "14px", marginBottom: "16px" }}>Tarih aralığını değiştirin veya satış verisi aktarın.</p>
                <button className="btn btn-primary" onClick={() => { setTab("upload"); setStep("select"); }}>
                  📤 Veri Aktar
                </button>
              </div>
            ) : (
              <div style={{ overflowX: "auto", maxHeight: "520px", overflowY: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--color-surface)" }}>
                    <tr>
                      <th>Tarih</th><th>Ürün Adı</th><th>Grup</th>
                      <th>Adet</th><th>Net Gelir</th><th>Tip</th>
                      <th style={{ textAlign: "right" }}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => {
                      const b = badge(r.saleType);
                      return (
                        <tr key={r.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{format(new Date(r.saleDate), "dd MMM yyyy", { locale: tr })}</td>
                          <td style={{ fontWeight: 500 }}>{r.productName}</td>
                          <td style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{r.productGroup}</td>
                          <td>{r.quantity}</td>
                          <td style={{ fontWeight: 700 }}>{r.netRevenue.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
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
