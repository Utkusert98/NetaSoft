"use client";
import { useLangContext } from "@/app/providers/LangProvider";
import { t, tx } from "@/lib/i18n/translations";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { ChartFormatter } from "@/lib/utils/chartTypes";
import PeriodRevenueWidget from "@/components/ui/PeriodRevenueWidget";
import PrescriptionRetailSplit from "@/components/ui/PrescriptionRetailSplit";

const fmt = (v: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(v);
const TT = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" };

interface MonthData {
  month: string; gelir: number; gider: number; kar: number;
  kasa: number; sgk: number; platform: number;
  sabitGider: number; personelGider: number;
  senetGider: number; depoHavalesi: number;
}

interface PromissoryNoteRow { dueDate: string; amount: number; isPaid: boolean; noteNumber: string; }
interface SupplierTransferRow { transferDate: string; supplierName: string; amount: number; }

interface ReportData {
  monthly: MonthData[];
  summary: { totalIncome: number; totalExpense: number; netProfit: number };
  promissoryNotes?: PromissoryNoteRow[];
  supplierTransfers?: SupplierTransferRow[];
}

function pctChange(cur: number, prev: number): { value: number; positive: boolean } | null {
  if (!prev) return null;
  const v = ((cur - prev) / prev) * 100;
  return { value: Math.abs(v), positive: v >= 0 };
}

function Badge({ cur, prev }: { cur: number; prev: number }) {
  const ch = pctChange(cur, prev);
  if (!ch) return null;
  return (
    <span style={{ fontSize: "11px", fontWeight: 600, color: ch.positive ? "#4e7c3f" : "#e74c3c", background: ch.positive ? "#f0fce8" : "#fff5f5", borderRadius: "99px", padding: "2px 8px" }}>
      {ch.positive ? "▲" : "▼"} %{ch.value.toFixed(1)}
    </span>
  );
}

function StatRow({ label, cur, prev }: { label: string; cur: number; prev: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
      <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{fmt(prev)}</span>
        <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)" }}>{fmt(cur)}</span>
        <Badge cur={cur} prev={prev} />
      </div>
    </div>
  );
}

export default function AylikOzetPage() {
  const { lang } = useLangContext();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // YYYY-MM-DD string — UTC timezone sorununu önlemek için ISO dönüşümü yapma
  const toDate = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  };
  const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

  const fetchData = async (y: number, m: number) => {
    setLoading(true);
    try {
      const start = toDate(y, m, 1);
      const end = toDate(y, m, lastDay(y, m));
      const res = await fetch(`/api/v1/raporlar/ozet?start=${start}&end=${end}`, { headers: { "Accept-Language": lang } });
      const json = await res.json() as { success: boolean; data?: ReportData };
      if (json.success && json.data) setData(json.data);
    } finally {
      setLoading(false);
    }
  };

  // Önceki ay verisi
  const [prevData, setPrevData] = useState<ReportData | null>(null);
  const fetchPrev = async (y: number, m: number) => {
    const prevM = m === 0 ? 11 : m - 1;
    const prevY = m === 0 ? y - 1 : y;
    const start = toDate(prevY, prevM, 1);
    const end = toDate(prevY, prevM, lastDay(prevY, prevM));
    const res = await fetch(`/api/v1/raporlar/ozet?start=${start}&end=${end}`, { headers: { "Accept-Language": lang } });
    const json = await res.json() as { success: boolean; data?: ReportData };
    if (json.success && json.data) setPrevData(json.data);
  };

  useEffect(() => {
    // Async veri çekimi — setState await sonrası çalışır, senkron değildir.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData(year, month);
    void fetchPrev(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const months = lang === "en" ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] : ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  const cur = data?.summary;
  const prev = prevData?.summary;

  // Yıllık trend için son 12 ay (mevcut ay dahil)
  const [yearTrend, setYearTrend] = useState<MonthData[]>([]);
  useEffect(() => {
    const load = async () => {
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      const res = await fetch(`/api/v1/raporlar/ozet?start=${start}&end=${end}`, { headers: { "Accept-Language": lang } });
      const json = await res.json() as { success: boolean; data?: ReportData };
      if (json.success && json.data) setYearTrend(json.data.monthly);
    };
    void load();
  }, [year]);

  return (
    <main className="page-content">
      {/* Başlık */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }}>
        <div>
          <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "var(--spacing-1)" }}>{tx(t.aylik.title, lang)}</h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>{lang === "en" ? "Financial summary of the selected month compared to the previous month." : "Seçilen ayın finansal özeti ve önceki ayla karşılaştırması."}</p>
        </div>
        <div style={{ display: "flex", gap: "var(--spacing-2)", alignItems: "center" }}>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="form-input" style={{ width: 130 }}>
            {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="form-input" style={{ width: 110 }}>
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "80px" }}><div className="spinner" style={{ margin: "0 auto" }} /></div>
      ) : (
        <>
          {/* Dönemsel Ciro (Kasa + Reçete) + Reçeteli/Perakende Dağılımı */}
          <div className="responsive-grid responsive-grid-1-1" style={{ gap: "var(--spacing-5)", marginBottom: "var(--spacing-5)" }}>
            <PeriodRevenueWidget
              startDate={toDate(year, month, 1)}
              endDate={toDate(year, month, lastDay(year, month))}
              title={lang === "en" ? `${months[month]} ${year} Revenue` : `${months[month]} ${year} Ciro`}
            />
            <PrescriptionRetailSplit
              startDate={toDate(year, month, 1)}
              endDate={toDate(year, month, lastDay(year, month))}
              title={lang === "en" ? "Sales Report: Prescription / Retail (this month)" : "Satış Raporu: Reçeteli / Perakende Dağılımı (bu ay)"}
            />
          </div>

          {/* Özet Kartlar */}
          <div className="grid-3" style={{ marginBottom: "var(--spacing-5)" }}>
            {[
              { label: lang === "en" ? "Total Income" : "Toplam Gelir", value: cur?.totalIncome ?? 0, prev: prev?.totalIncome ?? 0, icon: "📈", color: "var(--color-income-green)" },
              { label: lang === "en" ? "Total Expense" : "Toplam Gider", value: cur?.totalExpense ?? 0, prev: prev?.totalExpense ?? 0, icon: "📉", color: "#e74c3c" },
              { label: lang === "en" ? "Net Profit" : "Net Kâr", value: cur?.netProfit ?? 0, prev: prev?.netProfit ?? 0, icon: "💰", color: "#3498db" },
            ].map(card => (
              <div key={card.label} style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-5)", borderTop: `3px solid ${card.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-2)" }}>
                  <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", fontWeight: 500 }}>{card.label}</span>
                  <span style={{ fontSize: "20px" }}>{card.icon}</span>
                </div>
                <p style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: card.color, marginBottom: "4px" }}>{fmt(card.value)}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{lang === "en" ? "Last month:" : "Geçen ay:"} {fmt(card.prev)}</span>
                  <Badge cur={card.value} prev={card.prev} />
                </div>
              </div>
            ))}
          </div>

          <div className="responsive-grid responsive-grid-1-1" style={{ gap: "var(--spacing-5)", marginBottom: "var(--spacing-5)" }}>
            {/* Gelir Kırılımı */}
            <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "var(--spacing-4)", fontSize: "var(--font-size-base)" }}>
                {months[month]} {lang === "en" ? "Income Detail" : "Gelir Detayı"}
              </h3>
              {data?.monthly[0] ? (
                <>
                  <StatRow label={lang === "en" ? "🏦 Cash Register (POS + Cash)" : "🏦 Kasa (POS + Nakit)"} cur={data.monthly[0].kasa} prev={prevData?.monthly[0]?.kasa ?? 0} />
                  <StatRow label={lang === "en" ? "🏥 SGK Invoices" : "🏥 SGK Faturaları"} cur={data.monthly[0].sgk} prev={prevData?.monthly[0]?.sgk ?? 0} />
                  {data.monthly[0].sgk === 0 && (
                    <p style={{ fontSize: "11px", color: "var(--color-text-muted)", padding: "4px 0 8px 0", fontStyle: "italic" }}>
                      {lang === "en"
                        ? "ℹ️ SGK invoices are shown by invoice date. Bank payment arrives on the 15th, 3 months after invoice date."
                        : "ℹ️ SGK faturaları fatura tarihine göre gösterilir. Banka ödemesi fatura tarihinden 3 ay sonra her ayın 15'inde yatar."}
                    </p>
                  )}
                  <StatRow label={lang === "en" ? "📱 Platform Revenue" : "📱 Platform Gelirleri"} cur={data.monthly[0].platform} prev={prevData?.monthly[0]?.platform ?? 0} />
                  <div style={{ padding: "12px 0", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                    <span>{lang === "en" ? "Total Income" : "Toplam Gelir"}</span>
                    <span style={{ color: "var(--color-income-green)" }}>{fmt(data.monthly[0].gelir)}</span>
                  </div>
                </>
              ) : (
                <p style={{ color: "var(--color-text-muted)", padding: "20px 0" }}>{lang === "en" ? "No income records for this month." : "Bu ay için gelir kaydı yok."}</p>
              )}
            </div>

            {/* Gider Kırılımı */}
            <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "var(--spacing-4)", fontSize: "var(--font-size-base)" }}>
                {months[month]} {lang === "en" ? "Expense Detail" : "Gider Detayı"}
              </h3>
              {data?.monthly[0] ? (
                <>
                  <StatRow label={lang === "en" ? "🧾 Fixed Expenses" : "🧾 Sabit Giderler"} cur={data.monthly[0].sabitGider} prev={prevData?.monthly[0]?.sabitGider ?? 0} />
                  <StatRow label={lang === "en" ? "👥 Staff Expenses" : "👥 Personel Giderleri"} cur={data.monthly[0].personelGider} prev={prevData?.monthly[0]?.personelGider ?? 0} />
                  <StatRow label={lang === "en" ? "📄 Promissory Notes (Due)" : "📄 Senetler (Vadeli)"} cur={data.monthly[0].senetGider ?? 0} prev={prevData?.monthly[0]?.senetGider ?? 0} />
                  <StatRow label={lang === "en" ? "🏦 Warehouse Transfer / EFT" : "🏦 Depo Havalesi / EFT"} cur={data.monthly[0].depoHavalesi ?? 0} prev={prevData?.monthly[0]?.depoHavalesi ?? 0} />
                  <div style={{ padding: "12px 0", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                    <span>{lang === "en" ? "Total Expense" : "Toplam Gider"}</span>
                    <span style={{ color: "#e74c3c" }}>{fmt(data.monthly[0].gider)}</span>
                  </div>
                </>
              ) : (
                <p style={{ color: "var(--color-text-muted)", padding: "20px 0" }}>{lang === "en" ? "No expense records for this month." : "Bu ay için gider kaydı yok."}</p>
              )}
            </div>
          </div>

          {/* Kar Marjı — full width below both detail panels */}
          {data?.monthly[0] && data.monthly[0].gelir > 0 && (
            <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-5)", marginBottom: "var(--spacing-5)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)" }}>{lang === "en" ? "Profit Margin" : "Kâr Marjı"}</span>
                <span style={{ fontWeight: 800, fontSize: "var(--font-size-base)", color: data.monthly[0].kar >= 0 ? "var(--color-income-green)" : "#e74c3c" }}>
                  %{((data.monthly[0].kar / data.monthly[0].gelir) * 100).toFixed(1)}
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-muted)", marginLeft: "8px" }}>
                    ({fmt(data.monthly[0].kar)} {lang === "en" ? "net profit" : "net kâr"})
                  </span>
                </span>
              </div>
              <div style={{ height: 12, background: "var(--color-border)", borderRadius: "99px", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(100, Math.max(0, (data.monthly[0].kar / data.monthly[0].gelir) * 100))}%`,
                  background: data.monthly[0].kar >= 0 ? "#4e7c3f" : "#e74c3c",
                  borderRadius: "99px",
                  transition: "width 0.4s ease",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "11px", color: "var(--color-text-muted)" }}>
                <span>{lang === "en" ? "Gelir:" : "Gelir:"} {fmt(data.monthly[0].gelir)}</span>
                <span>{lang === "en" ? "Expense:" : "Gider:"} {fmt(data.monthly[0].gider)}</span>
              </div>
            </div>
          )}

          {/* Senetler Tablosu */}
          {data?.promissoryNotes && data.promissoryNotes.length > 0 && (
            <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)", marginBottom: "var(--spacing-5)" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "var(--spacing-4)", fontSize: "var(--font-size-base)" }}>
                📄 {lang === "en" ? "Promissory Notes Due This Month" : "Bu Ay Vadesi Gelen Senetler"}
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th>{lang === "en" ? "Note No" : "Senet No"}</th>
                      <th>{lang === "en" ? "Due Date" : "Vade Tarihi"}</th>
                      <th>{lang === "en" ? "Amount" : "Tutar"}</th>
                      <th>{lang === "en" ? "Status" : "Durum"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.promissoryNotes.map((n, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{n.noteNumber}</td>
                        <td>{new Date(n.dueDate).toLocaleDateString("tr-TR")}</td>
                        <td style={{ fontWeight: 700 }}>{n.amount.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</td>
                        <td>
                          <span style={{ padding: "2px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 600,
                            background: n.isPaid ? "#e8f5e9" : "#fff3e0",
                            color: n.isPaid ? "#2e7d32" : "#e65100" }}>
                            {n.isPaid ? (lang === "en" ? "Paid" : "Ödendi") : (lang === "en" ? "Pending" : "Bekliyor")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Depo Havaleleri Tablosu */}
          {data?.supplierTransfers && data.supplierTransfers.length > 0 && (
            <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)", marginBottom: "var(--spacing-5)" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "var(--spacing-4)", fontSize: "var(--font-size-base)" }}>
                🏦 {lang === "en" ? "Warehouse Transfers This Month" : "Bu Ay Depo Havaleleri"}
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th>{lang === "en" ? "Date" : "Tarih"}</th>
                      <th>{lang === "en" ? "Warehouse" : "Depo"}</th>
                      <th>{lang === "en" ? "Amount" : "Tutar"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.supplierTransfers.map((t, i) => (
                      <tr key={i}>
                        <td>{new Date(t.transferDate).toLocaleDateString("tr-TR")}</td>
                        <td style={{ fontWeight: 600 }}>{t.supplierName}</td>
                        <td style={{ fontWeight: 700, color: "#e74c3c" }}>{t.amount.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid var(--color-border)" }}>
                      <td colSpan={2} style={{ fontWeight: 700, paddingTop: "10px" }}>{lang === "en" ? "Total" : "Toplam"}</td>
                      <td style={{ fontWeight: 800, color: "#e74c3c", paddingTop: "10px" }}>
                        {data.supplierTransfers.reduce((s, t) => s + t.amount, 0)
                          .toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Yıllık Trend */}
          {yearTrend.length > 0 && (
            <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "var(--spacing-5)", fontSize: "var(--font-size-base)" }}>
                {lang === "en" ? `${year} Monthly Income / Expense Comparison` : `${year} Yılı Aylık Gelir / Gider Karşılaştırması`}
              </h3>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearTrend} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={((v: number) => fmt(v)) as ChartFormatter} contentStyle={TT} />
                    <Bar dataKey="gelir" name={lang === "en" ? "Income" : "Gelir"} fill="#4e7c3f" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="gider" name={lang === "en" ? "Expense" : "Gider"} fill="#e74c3c" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
