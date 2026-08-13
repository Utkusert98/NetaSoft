"use client";

import { useEffect, useState } from "react";
import { Receipt, Info } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useLangContext } from "@/app/providers/LangProvider";
import { formatCurrency } from "@/lib/utils";
import type { ChartFormatter } from "@/lib/utils/chartTypes";

const PIE_COLORS = ["#4e7c3f", "#1565c0"];

type SatisSummary = {
  prescriptionRevenue: number;
  retailRevenue: number;
  totalRecords: number;
};

/**
 * Satış Raporu'ndaki (SaleRecord) reçeteli/perakende ciro dağılımını, verilen
 * tarih aralığı için küçük bir donut grafik olarak gösterir. Panel (Dashboard),
 * Aylık Özet ve Gelir-Gider sayfalarında AYNI bileşen kullanılır — kopyalama
 * yerine tek kaynak.
 *
 * SADECE bilgilendirme amaçlıdır: Satış Raporu'ndaki GERÇEK satış tutarlarını
 * gösterir, hiçbir resmi toplamı (Kasa, SGK Fatura, Toplam Gelir/Net Kâr)
 * BESLEMEZ veya değiştirmez. Faturalanabilir/tahsil edilebilir reçeteli
 * gelirin tek doğruluk kaynağı SGK Fatura olmaya devam eder.
 */
export default function PrescriptionRetailSplit({
  startDate,
  endDate,
  title,
  compact = false,
}: {
  startDate: string;
  endDate: string;
  title?: string;
  compact?: boolean;
}): React.JSX.Element {
  const { lang } = useLangContext();
  const en = lang === "en";

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SatisSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/satis?${new URLSearchParams({ start: startDate, end: endDate })}`,
          { headers: { "Accept-Language": lang } },
        );
        const json = await res.json() as {
          success: boolean;
          data?: { summary: SatisSummary };
        };
        if (cancelled) return;
        setSummary(json.success && json.data ? json.data.summary : null);
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [startDate, endDate, lang]);

  const heading = title ?? (en ? "Prescription / Retail Distribution (Sales Report)" : "Reçeteli / Perakende Dağılımı (Satış Raporu)");

  const total = (summary?.prescriptionRevenue ?? 0) + (summary?.retailRevenue ?? 0);
  const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0;
  const data = summary ? [
    { name: en ? "Prescription" : "Reçeteli", value: summary.prescriptionRevenue, pct: pct(summary.prescriptionRevenue) },
    { name: en ? "Retail" : "Perakende", value: summary.retailRevenue, pct: pct(summary.retailRevenue) },
  ] : [];

  return (
    <div className="card">
      <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)", display: "flex", alignItems: "center", gap: "8px" }}>
        <Receipt size={18} style={{ color: "var(--color-text-muted)" }} /> {heading}
      </h2>

      {loading ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div className="spinner" />
        </div>
      ) : !summary || total <= 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", textAlign: "center", padding: "16px 0" }}>
          {en ? "No Sales Report data for this period." : "Bu dönem için Satış Raporu verisi yok."}
        </p>
      ) : (
        <>
          <div style={{ height: compact ? 160 : 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={compact ? 42 : 55}
                  outerRadius={compact ? 65 : 85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {data.map((_entry, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={((value: string | number | undefined, _name: string | number | undefined, item: { payload?: { pct: number } }) =>
                    [`${formatCurrency(Number(value ?? 0))} (%${item?.payload?.pct ?? 0})`, en ? "Revenue" : "Gelir"]) as ChartFormatter}
                  contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "var(--spacing-2)" }}>
            {data.map((d, i) => (
              <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--font-size-sm)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: PIE_COLORS[i], flexShrink: 0 }} />
                  <span>{d.name}</span>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>%{d.pct}</span>
                  <span style={{ fontWeight: 700 }}>{formatCurrency(d.value)}</span>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "var(--spacing-3)", display: "flex", alignItems: "flex-start", gap: "5px" }}>
            <Info size={12} style={{ flexShrink: 0, marginTop: "2px" }} /> {en
              ? "Informational only, sourced from Sales Report. Does not feed into any official total (Register total, Total Income, SGK Invoice)."
              : "Sadece bilgilendirme amaçlıdır, Satış Raporu'ndan kaynaklanır. Hiçbir resmi toplamı (Kasa toplamı, Toplam Gelir, SGK Fatura) beslemez."}
          </p>
        </>
      )}
    </div>
  );
}
