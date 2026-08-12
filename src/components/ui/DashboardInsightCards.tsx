"use client";

import { useEffect, useState } from "react";
import { useLangContext } from "@/app/providers/LangProvider";
import { formatCurrency } from "@/lib/utils";
import { topProductsByRevenue, type TopProduct } from "@/lib/sales/aggregations";
import PrescriptionRetailSplit from "./PrescriptionRetailSplit";

const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function monthRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toDateStr(now),
  };
}

type SatisRecordLite = { productName: string; netRevenue: number; quantity: number };

/**
 * "Bu Ayın En Çok Satan Ürünleri" — Satış Raporu'ndaki (SaleRecord) mevcut ay
 * verisinden üretilen kısa/özet bir üst-5 listesi. Sadece bilgilendirme
 * amaçlıdır, hiçbir resmi Dashboard toplamını (summary.totalIncome vb.)
 * beslemez — bağımsız olarak /api/v1/satis'ten veri çeker.
 */
function TopProductsCard(): React.JSX.Element {
  const { lang } = useLangContext();
  const en = lang === "en";
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<TopProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const { start, end } = monthRange();
        const res = await fetch(`/api/v1/satis?${new URLSearchParams({ start, end })}`, { headers: { "Accept-Language": lang } });
        const json = await res.json() as { success: boolean; data?: { records: SatisRecordLite[] } };
        if (cancelled) return;
        const records = json.success && json.data ? json.data.records : [];
        setProducts(topProductsByRevenue(records, 5));
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [lang]);

  const maxRevenue = products.length > 0 ? products[0].revenue : 0;

  return (
    <div className="card">
      <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>
        🏆 {en ? "Top-Selling Products This Month" : "Bu Ayın En Çok Satan Ürünleri"}
      </h2>
      {loading ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}><div className="spinner" /></div>
      ) : products.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", textAlign: "center", padding: "16px 0" }}>
          {en ? "No Sales Report data for this month." : "Bu ay için Satış Raporu verisi yok."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {products.map((p, i) => (
            <div key={p.productName} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "13px" }}>
                <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {i + 1}. {p.productName}
                </span>
                <span style={{ fontWeight: 700, flexShrink: 0 }}>{formatCurrency(p.revenue)}</span>
              </div>
              <div style={{ height: 6, background: "var(--color-border)", borderRadius: "99px", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${maxRevenue > 0 ? Math.max(4, (p.revenue / maxRevenue) * 100) : 0}%`,
                  background: "#4e7c3f",
                  borderRadius: "99px",
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type InventoryReportLite = {
  id: string;
  fileName: string;
  totalRevenue: number | string;
  totalProfit: number | string;
  profitMargin: number | string;
  totalStockValue: number | string;
  createdAt: string;
};

/**
 * "Son Envanter Özeti" — en son yüklenen/onaylanan Envanter Analizi
 * (InventoryReport) anlık görüntüsünün özet alanlarını gösterir. CANLI stok
 * verisi değildir, son yüklenen rapora göredir. Sadece bilgilendirme
 * amaçlıdır ve hiçbir resmi toplamı etkilemez.
 */
function LastInventorySummaryCard(): React.JSX.Element {
  const { lang } = useLangContext();
  const en = lang === "en";
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<InventoryReportLite | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const res = await fetch("/api/v1/stok/envanter-raporu", { headers: { "Accept-Language": lang } });
        const json = await res.json() as { success: boolean; data?: InventoryReportLite[] };
        if (cancelled) return;
        setReport(json.success && json.data && json.data.length > 0 ? json.data[0] : null);
      } catch {
        if (!cancelled) setReport(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [lang]);

  return (
    <div className="card">
      <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>
        📦 {en ? "Latest Inventory Summary" : "Son Envanter Özeti"}
      </h2>
      {loading ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}><div className="spinner" /></div>
      ) : !report ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", textAlign: "center", padding: "16px 0" }}>
          {en ? "No Inventory Report uploaded yet." : "Henüz yüklenmiş bir Envanter Raporu yok."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
          <p style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
            {en ? "As of the last uploaded report" : "Son yüklenen envanter raporuna göre"} · {new Date(report.createdAt).toLocaleDateString("tr-TR")}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>{en ? "Total Stock Value" : "Toplam Stok Değeri"}</span>
            <span style={{ fontWeight: 700, fontSize: "15px" }}>{formatCurrency(report.totalStockValue)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>{en ? "Profit Margin" : "Kâr Marjı"}</span>
            <span style={{ fontWeight: 700, fontSize: "15px", color: Number(report.profitMargin) >= 0 ? "var(--color-income-green)" : "#e74c3c" }}>
              %{Number(report.profitMargin).toFixed(1)}
            </span>
          </div>
          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📄 {report.fileName}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Gösterge Paneli'ne eklenen 3 küçük, özet/bilgilendirici kart:
 * En çok satan ürünler, reçeteli/perakende dağılımı, son envanter özeti.
 * Hepsi kendi verisini bağımsız çeker; DashboardClient'ın `summary`
 * state'ine veya herhangi bir resmi toplama dokunmaz.
 */
export default function DashboardInsightCards(): React.JSX.Element {
  const { start, end } = monthRange();
  return (
    <div className="responsive-grid responsive-grid-1-1-1" style={{ gap: "var(--spacing-5)", marginBottom: "var(--spacing-5)" }}>
      <TopProductsCard />
      <PrescriptionRetailSplit startDate={start} endDate={end} compact />
      <LastInventorySummaryCard />
    </div>
  );
}
