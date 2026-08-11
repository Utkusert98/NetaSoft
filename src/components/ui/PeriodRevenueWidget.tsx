"use client";

import { useEffect, useState } from "react";
import { useLangContext } from "@/app/providers/LangProvider";

type KasaRecord = {
  registerDate: string;
  posAmount: number;
  cashAmount: number;
  wireAmount: number;
};

type SatisRecord = {
  saleDate: string;
  netRevenue: number;
};

const fmt = (v: number): string =>
  v.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });

/**
 * Dönemsel Ciro Widget'ı — Kasa'nın (POS+Nakit+Havale) resmi toplamını ve
 * Satış Raporu'ndaki reçeteli net geliri seçilen tarih aralığı için bir
 * araya getirip gösterir. SADECE bilgilendirme amaçlıdır: burada gösterilen
 * "Toplam Ciro (Kasa + Reçete)" hiçbir resmi hesaplamayı (Kasa toplamı,
 * Gösterge Paneli'ndeki Toplam Gelir, SGK Fatura tutarları) BESLEMEZ veya
 * değiştirmez. Faturalanabilir/tahsil edilebilir reçeteli gelirin tek
 * doğruluk kaynağı SGK Fatura olmaya devam eder.
 */
export default function PeriodRevenueWidget({
  startDate,
  endDate,
  title,
}: {
  startDate: string;
  endDate: string;
  title?: string;
}): React.JSX.Element {
  const { lang } = useLangContext();

  const [loading, setLoading] = useState(true);
  const [kasaTotal, setKasaTotal] = useState<number | null>(null);
  const [rxTotal, setRxTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const [kasaRes, satisRes] = await Promise.all([
          fetch("/api/v1/finans/kasa", { headers: { "Accept-Language": lang } }),
          fetch(`/api/v1/satis?${new URLSearchParams({ start: startDate, end: endDate, type: "PRESCRIPTION" })}`, {
            headers: { "Accept-Language": lang },
          }),
        ]);

        const kasaJson = await kasaRes.json() as { success: boolean; data?: KasaRecord[] };
        const satisJson = await satisRes.json() as { success: boolean; data?: { records: SatisRecord[] } };

        if (cancelled) return;

        if (kasaJson.success && kasaJson.data) {
          const inRange = kasaJson.data.filter(r => {
            const d = r.registerDate.slice(0, 10);
            return d >= startDate && d <= endDate;
          });
          if (inRange.length > 0) {
            const total = inRange.reduce(
              (sum, r) => sum + Number(r.posAmount) + Number(r.cashAmount) + Number(r.wireAmount),
              0
            );
            setKasaTotal(total);
          } else {
            setKasaTotal(null);
          }
        } else {
          setKasaTotal(null);
        }

        if (satisJson.success && satisJson.data) {
          const total = satisJson.data.records.reduce((sum, r) => sum + Number(r.netRevenue), 0);
          setRxTotal(total);
        } else {
          setRxTotal(0);
        }
      } catch {
        if (!cancelled) {
          setKasaTotal(null);
          setRxTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [startDate, endDate, lang]);

  const heading = title ?? (lang === "en" ? "Period Revenue" : "Dönemsel Ciro");
  const hasKasa = kasaTotal !== null;
  const combinedTotal = (kasaTotal ?? 0) + rxTotal;

  return (
    <div className="card">
      <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>
        📊 {heading}
      </h2>

      {loading ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div className="spinner" />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: "8px",
          }}>
            <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
              {lang === "en" ? "Register Total (period) (POS+Cash+Wire)" : "Kasa Toplamı (dönem) (POS+Nakit+Havale)"}
            </span>
            <span style={{ fontWeight: 700, fontSize: "15px" }}>
              {hasKasa ? fmt(kasaTotal!) : (
                <span style={{ fontWeight: 400, fontSize: "13px", color: "var(--color-text-muted)" }}>
                  {lang === "en" ? "No register entry for the selected period yet" : "Seçili dönem için henüz kasa girişi yok"}
                </span>
              )}
            </span>
          </div>

          {rxTotal > 0 && (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              flexWrap: "wrap", gap: "8px",
            }}>
              <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
                {lang === "en" ? "Prescription Sales (Sales Report)" : "Reçeteli Satış (Satış Raporu)"}
              </span>
              <span style={{ fontWeight: 700, fontSize: "15px" }}>{fmt(rxTotal)}</span>
            </div>
          )}

          {(hasKasa || rxTotal > 0) && (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              flexWrap: "wrap", gap: "8px",
              padding: "10px 12px", background: "var(--color-primary-light)",
              borderRadius: "var(--radius-md)", border: "1px solid var(--color-primary)",
              marginTop: "4px",
            }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-on-primary-light)" }}>
                {lang === "en" ? "Total Revenue (Register + Prescription)" : "Toplam Ciro (Kasa + Reçete)"}
              </span>
              <span style={{ fontWeight: 800, fontSize: "17px", color: "var(--color-on-primary-light)" }}>
                {fmt(combinedTotal)}
              </span>
            </div>
          )}

          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
            ℹ️ {lang === "en"
              ? "Informational only. This combined total does not feed into any other page's official figures — SGK Invoice remains the source of truth for invoiced/collectible prescription revenue."
              : "Sadece bilgilendirme amaçlıdır. Bu toplam başka hiçbir sayfanın resmi rakamlarını beslemez veya değiştirmez — faturalanabilir/tahsil edilebilir reçeteli gelirin doğruluk kaynağı SGK Fatura'dır."}
          </p>
        </div>
      )}
    </div>
  );
}
