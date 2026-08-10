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
};

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

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

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
    </main>
  );
}
