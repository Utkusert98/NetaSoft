"use client";
import { useLangContext } from "@/app/providers/LangProvider";

import { useState, useEffect, useCallback } from "react";

interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  user: { name: string | null; email: string | null } | null;
}

interface AuditLogResponse {
  items: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

const ENTITY_LABELS: Record<string, string> = {
  SgkInvoice: "SGK Fatura",
  DailyRegister: "Günlük Kasa",
  PromissoryNote: "Senet",
  PlatformIncome: "Platform Geliri",
  FixedExpense: "Sabit Gider",
  EmployeeExpense: "Personel Gideri",
  Employee: "Çalışan",
  SupplierTransfer: "Depo Havalesi",
  User: "Kullanıcı",
  SaleRecordBatch: "Satış Raporu İçe Aktarma",
  DailyRegisterBatch: "Kasa Toplu İçe Aktarma",
  InventoryReport: "Envanter Raporu",
};

interface SalesBatchRow {
  importBatchId: string | null;
  fileName: string | null;
  importDate: string | null;
  recordCount: number;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  totalRevenue: number;
}

interface InventoryReportRow {
  id: string;
  fileName: string;
  totalRevenue: number;
  createdAt: string;
}

const NONE_BUCKET = "_none_";
const fmtCurrency = (v: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(v);
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("tr-TR") : "—";

function entityTypeLabel(type: string): string {
  return ENTITY_LABELS[type] ?? type;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Oluşturuldu",
  UPDATE: "Güncellendi",
  DELETE: "Silindi",
  LOGIN: "Giriş Yapıldı",
};

const ACTION_COLORS: Record<string, { bg: string; fg: string }> = {
  CREATE: { bg: "#e8f5e9", fg: "#2e7d32" },
  UPDATE: { bg: "#e3f2fd", fg: "#1565c0" },
  DELETE: { bg: "#fdecea", fg: "#c0392b" },
  LOGIN: { bg: "#eceff1", fg: "#455a64" },
};

function ActionBadge({ action, lang }: { action: string; lang: "tr" | "en" }) {
  const color = ACTION_COLORS[action] ?? ACTION_COLORS.LOGIN;
  const label = lang === "en" ? action : (ACTION_LABELS[action] ?? action);
  return (
    <span style={{ padding: "2px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 600, background: color.bg, color: color.fg }}>
      {label}
    </span>
  );
}

export default function DenetimKayitlariPage() {
  const { lang } = useLangContext();
  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const pageSize = 25;

  const [salesBatches, setSalesBatches] = useState<SalesBatchRow[]>([]);
  const [inventoryReports, setInventoryReports] = useState<InventoryReportRow[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(true);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "sales" | "inventory"; key: string; label: string } | null>(null);

  const fetchUploads = useCallback(async () => {
    setUploadsLoading(true);
    try {
      const [salesRes, invRes] = await Promise.all([
        fetch("/api/v1/satis/batches", { headers: { "Accept-Language": lang } }),
        fetch("/api/v1/stok/envanter-raporu", { headers: { "Accept-Language": lang } }),
      ]);
      const salesJson = await salesRes.json() as { success: boolean; data?: { batches: SalesBatchRow[] } };
      const invJson = await invRes.json() as { success: boolean; data?: InventoryReportRow[] };
      setSalesBatches(salesJson.success && salesJson.data ? salesJson.data.batches : []);
      setInventoryReports(invJson.success && invJson.data ? invJson.data : []);
    } finally {
      setUploadsLoading(false);
    }
  }, [lang]);

  const fetchData = useCallback(async (p: number, filter: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
      if (filter) params.set("action", filter);
      const res = await fetch(`/api/v1/raporlar/denetim-kayitlari?${params.toString()}`, { headers: { "Accept-Language": lang } });
      const json = await res.json() as { success: boolean; data?: AuditLogResponse };
      if (json.success && json.data) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchData(page, actionFilter);
    }, 0);
    return () => clearTimeout(timer);
  }, [page, actionFilter, fetchData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchUploads();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchUploads]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeletingKey(confirmDelete.key);
    try {
      const url = confirmDelete.kind === "sales"
        ? `/api/v1/satis/batches/${encodeURIComponent(confirmDelete.key)}`
        : `/api/v1/stok/envanter-raporu/${confirmDelete.key}`;
      const res = await fetch(url, { method: "DELETE", headers: { "Accept-Language": lang } });
      const json = await res.json() as { success: boolean };
      if (json.success) {
        await fetchUploads();
        void fetchData(page, actionFilter);
      }
    } finally {
      setDeletingKey(null);
      setConfirmDelete(null);
    }
  };

  return (
    <main className="page-content">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }}>
        <div>
          <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "var(--spacing-1)" }}>
            {lang === "en" ? "Audit Log" : "Denetim Kayıtları"}
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
            {lang === "en" ? "History of critical financial changes made in the system." : "Sistemde yapılan kritik finansal değişikliklerin geçmişi."}
          </p>
        </div>
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          className="form-input"
          style={{ width: 180 }}
        >
          <option value="">{lang === "en" ? "All" : "Tümü"}</option>
          <option value="CREATE">{lang === "en" ? "Created" : "Oluşturuldu"}</option>
          <option value="UPDATE">{lang === "en" ? "Updated" : "Güncellendi"}</option>
          <option value="DELETE">{lang === "en" ? "Deleted" : "Silindi"}</option>
          <option value="LOGIN">{lang === "en" ? "Login" : "Giriş"}</option>
        </select>
      </div>

      <div className="card" style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px" }}><div className="spinner" style={{ margin: "0 auto" }} /></div>
        ) : !data || data.items.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", padding: "20px 0", textAlign: "center" }}>
            {lang === "en" ? "No audit log records yet." : "Henüz denetim kaydı yok."}
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th>{lang === "en" ? "Date" : "Tarih"}</th>
                    <th>{lang === "en" ? "User" : "Kullanıcı"}</th>
                    <th>{lang === "en" ? "Action" : "İşlem"}</th>
                    <th>{lang === "en" ? "Entity Type" : "Varlık Türü"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(row => (
                    <tr key={row.id}>
                      <td>{new Date(row.createdAt).toLocaleString("tr-TR")}</td>
                      <td>{row.user?.name ?? row.user?.email ?? (lang === "en" ? "Unknown" : "Bilinmiyor")}</td>
                      <td><ActionBadge action={row.action} lang={lang} /></td>
                      <td>{entityTypeLabel(row.entityType)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--spacing-4)" }}>
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                {lang === "en" ? `Page ${data.page} / ${totalPages} (${data.total} records)` : `Sayfa ${data.page} / ${totalPages} (${data.total} kayıt)`}
              </span>
              <div style={{ display: "flex", gap: "var(--spacing-2)" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  {lang === "en" ? "Previous" : "Önceki"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  {lang === "en" ? "Next" : "Sonraki"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: "var(--spacing-8)" }}>
        <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: 800, marginBottom: "var(--spacing-1)" }}>
          {lang === "en" ? "Uploaded Data" : "Yüklenen Veriler"}
        </h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", marginBottom: "var(--spacing-4)" }}>
          {lang === "en"
            ? "Sales Report imports and Inventory Analysis reports you've uploaded. Deleting here is a soft delete and is recorded in the audit log above."
            : "Yüklediğiniz Satış Raporu içe aktarmaları ve Envanter Analizi raporları. Buradan silme işlemi geri alınabilir (soft delete) ve yukarıdaki denetim kaydına işlenir."}
        </p>

        <div className="card" style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)", marginBottom: "var(--spacing-5)" }}>
          <h3 style={{ fontSize: "var(--font-size-md)", fontWeight: 700, marginBottom: "var(--spacing-3)" }}>
            📊 {lang === "en" ? "Sales Report Imports" : "Satış Raporu İçe Aktarmaları"}
          </h3>
          {uploadsLoading ? (
            <div style={{ textAlign: "center", padding: "24px" }}><div className="spinner" style={{ margin: "0 auto" }} /></div>
          ) : salesBatches.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", padding: "12px 0" }}>
              {lang === "en" ? "No Sales Report data uploaded yet." : "Henüz Satış Raporu verisi yüklenmemiş."}
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th>{lang === "en" ? "Upload Date" : "Yükleme Tarihi"}</th>
                    <th>{lang === "en" ? "File Name" : "Dosya Adı"}</th>
                    <th>{lang === "en" ? "Date Range" : "Tarih Aralığı"}</th>
                    <th>{lang === "en" ? "Records" : "Kayıt Sayısı"}</th>
                    <th>{lang === "en" ? "Revenue" : "Ciro"}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {salesBatches.map(b => {
                    const key = b.importBatchId ?? NONE_BUCKET;
                    return (
                      <tr key={key}>
                        <td>{fmtDate(b.importDate)}</td>
                        <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.fileName ?? undefined}>
                          {b.fileName ?? "—"}
                        </td>
                        <td>{fmtDate(b.dateRangeStart)} – {fmtDate(b.dateRangeEnd)}</td>
                        <td>{b.recordCount}</td>
                        <td>{fmtCurrency(b.totalRevenue)}</td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ color: "var(--color-danger)", fontSize: "12px", padding: "6px 12px" }}
                            disabled={deletingKey === key}
                            onClick={() => setConfirmDelete({
                              kind: "sales",
                              key,
                              label: lang === "en"
                                ? `${b.recordCount} sales records${b.fileName ? ` (${b.fileName})` : ""} (${fmtDate(b.dateRangeStart)} – ${fmtDate(b.dateRangeEnd)})`
                                : `${b.recordCount} satış kaydı${b.fileName ? ` (${b.fileName})` : ""} (${fmtDate(b.dateRangeStart)} – ${fmtDate(b.dateRangeEnd)})`,
                            })}
                          >
                            🗑 {lang === "en" ? "Delete" : "Sil"}
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

        <div className="card" style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
          <h3 style={{ fontSize: "var(--font-size-md)", fontWeight: 700, marginBottom: "var(--spacing-3)" }}>
            📦 {lang === "en" ? "Inventory Analysis Reports" : "Envanter Analizi Raporları"}
          </h3>
          {uploadsLoading ? (
            <div style={{ textAlign: "center", padding: "24px" }}><div className="spinner" style={{ margin: "0 auto" }} /></div>
          ) : inventoryReports.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", padding: "12px 0" }}>
              {lang === "en" ? "No Inventory Report uploaded yet." : "Henüz Envanter Raporu yüklenmemiş."}
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th>{lang === "en" ? "Upload Date" : "Yükleme Tarihi"}</th>
                    <th>{lang === "en" ? "File Name" : "Dosya Adı"}</th>
                    <th>{lang === "en" ? "Stock Value" : "Stok Değeri"}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryReports.map(r => (
                    <tr key={r.id}>
                      <td>{fmtDate(r.createdAt)}</td>
                      <td>{r.fileName}</td>
                      <td>{fmtCurrency(r.totalRevenue)}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ color: "var(--color-danger)", fontSize: "12px", padding: "6px 12px" }}
                          disabled={deletingKey === r.id}
                          onClick={() => setConfirmDelete({ kind: "inventory", key: r.id, label: r.fileName })}
                        >
                          🗑 {lang === "en" ? "Delete" : "Sil"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="card"
            style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", padding: "var(--spacing-6)", width: "100%", maxWidth: "440px" }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "var(--spacing-3)" }}>
              ⚠️ {lang === "en" ? "Confirm Deletion" : "Silme Onayı"}
            </h3>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-sm)", marginBottom: "var(--spacing-5)", lineHeight: 1.6 }}>
              {lang === "en"
                ? `Are you sure you want to delete ${confirmDelete.label}? This action is recorded in the audit log and can be traced, but the data will disappear from all reports.`
                : `${confirmDelete.label} silinsin mi? Bu işlem denetim kaydına işlenir ve izlenebilir, ancak veriler tüm raporlardan kaybolacaktır.`}
            </p>
            <div style={{ display: "flex", gap: "var(--spacing-3)", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                {lang === "en" ? "Cancel" : "Vazgeç"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: "var(--color-danger)", borderColor: "var(--color-danger)" }}
                disabled={deletingKey !== null}
                onClick={() => void handleConfirmDelete()}
              >
                {deletingKey !== null ? (lang === "en" ? "Deleting..." : "Siliniyor...") : (lang === "en" ? "Delete" : "Sil")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
