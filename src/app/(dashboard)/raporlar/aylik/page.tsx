"use client";
import { useLangContext } from "@/app/providers/LangProvider";
import { t, tx } from "@/lib/i18n/translations";

import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFmt = (...args: any[]) => any;
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

  const fetchData = useCallback(async (y: number, m: number) => {
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
  }, []);

  // Önceki ay verisi
  const [prevData, setPrevData] = useState<ReportData | null>(null);
  const fetchPrev = useCallback(async (y: number, m: number) => {
    const prevM = m === 0 ? 11 : m - 1;
    const prevY = m === 0 ? y - 1 : y;
    const start = toDate(prevY, prevM, 1);
    const end = toDate(prevY, prevM, lastDay(prevY, prevM));
    const res = await fetch(`/api/v1/raporlar/ozet?start=${start}&end=${end}`, { headers: { "Accept-Language": lang } });
    const json = await res.json() as { success: boolean; data?: ReportData };
    if (json.success && json.data) setPrevData(json.data);
  }, []);

  useEffect(() => {
    void fetchData(year, month);
    void fetchPrev(year, month);
  }, [year, month, fetchData, fetchPrev]);

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
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>Seçilen ayın finansal özeti ve önceki ayla karşılaştırması.</p>
        </div>
        <div style={{ display: "flex", gap: "var(--spacing-2)", alignItems: "center" }}>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="form-input" style={{ width: 130 }}>
            {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="form-input" style={{ width: 90 }}>
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "80px" }}><div className="spinner" style={{ margin: "0 auto" }} /></div>
      ) : (
        <>
          {/* Özet Kartlar */}
          <div className="grid-3" style={{ marginBottom: "var(--spacing-5)" }}>
            {[
              { label: lang === "en" ? "Total Income" : "Toplam Gelir", value: cur?.totalIncome ?? 0, prev: prev?.totalIncome ?? 0, icon: "📈", color: "#4e7c3f" },
              { label: lang === "en" ? "Total Expense" : "Toplam Gider", value: cur?.totalExpense ?? 0, prev: prev?.totalExpense ?? 0, icon: "📉", color: "#e74c3c" },
              { label: "Net Kâr", value: cur?.netProfit ?? 0, prev: prev?.netProfit ?? 0, icon: "💰", color: "#3498db" },
            ].map(card => (
              <div key={card.label} style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-5)", borderTop: `3px solid ${card.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-2)" }}>
                  <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", fontWeight: 500 }}>{card.label}</span>
                  <span style={{ fontSize: "20px" }}>{card.icon}</span>
                </div>
                <p style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: card.color, marginBottom: "4px" }}>{fmt(card.value)}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Geçen ay: {fmt(card.prev)}</span>
                  <Badge cur={card.value} prev={card.prev} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-5)", marginBottom: "var(--spacing-5)" }}>
            {/* Gelir Kırılımı */}
            <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "var(--spacing-4)", fontSize: "var(--font-size-base)" }}>
                {months[month]} Gelir Detayı
              </h3>
              {data?.monthly[0] ? (
                <>
                  <StatRow label="🏦 Kasa (POS + Nakit)" cur={data.monthly[0].kasa} prev={prevData?.monthly[0]?.kasa ?? 0} />
                  <StatRow label="🏥 SGK Faturaları" cur={data.monthly[0].sgk} prev={prevData?.monthly[0]?.sgk ?? 0} />
                  <StatRow label="📱 Platform Gelirleri" cur={data.monthly[0].platform} prev={prevData?.monthly[0]?.platform ?? 0} />
                  <div style={{ padding: "12px 0", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                    <span>{lang === "en" ? "Total Income" : "Toplam Gelir"}</span>
                    <span style={{ color: "#4e7c3f" }}>{fmt(data.monthly[0].gelir)}</span>
                  </div>
                </>
              ) : (
                <p style={{ color: "var(--color-text-muted)", padding: "20px 0" }}>Bu ay için gelir kaydı yok.</p>
              )}
            </div>

            {/* Gider Kırılımı */}
            <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "var(--spacing-4)", fontSize: "var(--font-size-base)" }}>
                {months[month]} Gider Detayı
              </h3>
              {data?.monthly[0] ? (
                <>
                  <StatRow label="🧾 Sabit Giderler" cur={data.monthly[0].sabitGider} prev={prevData?.monthly[0]?.sabitGider ?? 0} />
                  <StatRow label="👥 Personel Giderleri" cur={data.monthly[0].personelGider} prev={prevData?.monthly[0]?.personelGider ?? 0} />
                  <StatRow label="📄 Senetler (Vadeli)" cur={data.monthly[0].senetGider ?? 0} prev={prevData?.monthly[0]?.senetGider ?? 0} />
                  <StatRow label="🏦 Depo Havalesi / EFT" cur={data.monthly[0].depoHavalesi ?? 0} prev={prevData?.monthly[0]?.depoHavalesi ?? 0} />
                  <div style={{ padding: "12px 0", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                    <span>{lang === "en" ? "Total Expense" : "Toplam Gider"}</span>
                    <span style={{ color: "#e74c3c" }}>{fmt(data.monthly[0].gider)}</span>
                  </div>
                  {data.monthly[0].gelir > 0 && (
                    <div style={{ marginTop: "var(--spacing-3)", padding: "10px 14px", borderRadius: "var(--radius-md)", background: "var(--color-bg)" }}>
                      <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "4px" }}>Kar Marjı</div>
                      <div style={{ height: 8, background: "var(--color-border)", borderRadius: "99px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, (data.monthly[0].kar / data.monthly[0].gelir) * 100))}%`, background: "#4e7c3f", borderRadius: "99px" }} />
                      </div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#4e7c3f", marginTop: "4px" }}>
                        %{data.monthly[0].gelir > 0 ? ((data.monthly[0].kar / data.monthly[0].gelir) * 100).toFixed(1) : "0"}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p style={{ color: "var(--color-text-muted)", padding: "20px 0" }}>Bu ay için gider kaydı yok.</p>
              )}
            </div>
          </div>

          {/* Senetler Tablosu */}
          {data?.promissoryNotes && data.promissoryNotes.length > 0 && (
            <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)", marginBottom: "var(--spacing-5)" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "var(--spacing-4)", fontSize: "var(--font-size-base)" }}>
                📄 Bu Ay Vadesi Gelen Senetler
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th>Senet No</th>
                      <th>Vade Tarihi</th>
                      <th>Tutar</th>
                      <th>Durum</th>
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
                            {n.isPaid ? "Ödendi" : "Bekliyor"}
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
                🏦 Bu Ay Depo Havaleleri
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Depo</th>
                      <th>Tutar</th>
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
                {year} Yılı Aylık Gelir / Gider Karşılaştırması
              </h3>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearTrend} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={((v: number) => fmt(v)) as AnyFmt} contentStyle={TT} />
                    <Bar dataKey="gelir" name="Gelir" fill="#4e7c3f" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="gider" name="Gider" fill="#e74c3c" radius={[3, 3, 0, 0]} />
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
