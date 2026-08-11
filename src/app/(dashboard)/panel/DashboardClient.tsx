"use client";

import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useLangContext } from "@/app/providers/LangProvider";
import { t, tx } from "@/lib/i18n/translations";

// ── Types ──────────────────────────────────────────────────────────────────
export interface DashboardData {
  summary: {
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
    incomeChange: number;
    expenseChange: number;
  };
  promissoryNotes: Array<{
    id: string;
    noteNumber: string;
    dueDate: string;
    amount: number;
    isPaid: boolean;
  }>;
  sgkVsCash: {
    sgkTotal: number;
    cashTotal: number;
    sgkCount: number;
    cashDays: number;
  };
  monthlyTrend: Array<{ month: string; gelir: number; gider: number; kar: number }>;
  upcomingSgk: Array<{ id: string; invoiceType: string; amount: number; expectedPaymentDate: string }>;
  platformIncome: Array<{ platformName: string; amount: number; status: string }>;
  dailyAvgCiro: number;
  cashPosSplit: { posTotal: number; cashTotal: number };
  expenseBreakdown: Array<{ name: string; nameEn: string; value: number }>;
  urgentNotesCount: number;
  runway30: { projectedIncome: number; committedExpense: number };
  dayComparison: {
    todayDate: string;
    compareDate: string;
    todayPos: number;
    todayCash: number;
    lastMonthDayPos: number;
    lastMonthDayCash: number;
    posChangePct: number;
    cashChangePct: number;
    hasData: boolean;
  };
  weekComparison: {
    weekIncome: number;
    prevWeekIncome: number;
    changePct: number;
    hasData: boolean;
  };
  monthComparison: {
    pos: { current: number; previous: number; changePct: number };
    cash: { current: number; previous: number; changePct: number };
    sgk: { current: number; previous: number; changePct: number };
    platform: { current: number; previous: number; changePct: number };
    totalIncome: { current: number; previous: number; changePct: number };
    totalExpense: { current: number; previous: number; changePct: number };
    netProfit: { current: number; previous: number; changePct: number };
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFmt = (...args: any[]) => any;

const GREEN = "#4e7c3f";
const GREEN_LIGHT = "#9fe870";
const RED = "#e74c3c";
const BLUE = "#3498db";
const ORANGE = "#f5a623";

// ── Summary card ───────────────────────────────────────────────────────────
function StatCard({ label, value, change, icon, accent }: {
  label: string; value: string; change?: number; icon: string;
  accent: "income" | "expense" | "profit";
}) {
  const { lang } = useLangContext();
  const colors = { income: GREEN, expense: RED, profit: BLUE };
  const bgs = { income: "#f0fce8", expense: "#fff5f5", profit: "#ebf8ff" };
  return (
    <div style={{
      background: "var(--color-surface)",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border)",
      padding: "var(--spacing-6)",
      display: "flex", flexDirection: "column", gap: "var(--spacing-2)",
      borderTop: `3px solid ${colors[accent]}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", fontWeight: 500 }}>{label}</span>
        <span style={{
          fontSize: "22px", width: 40, height: 40, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: bgs[accent], borderRadius: "var(--radius-md)",
        }}>{icon}</span>
      </div>
      <p style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: colors[accent], lineHeight: 1.1 }}>{value}</p>
      {change !== undefined && change !== 0 && (
        <p style={{ fontSize: "var(--font-size-xs)", color: change > 0 ? GREEN : RED, fontWeight: 500 }}>
          {change > 0 ? "▲" : "▼"} %{Math.abs(change).toFixed(1)} {tx(t.dashboard.vsLastMonth, lang)}
        </p>
      )}
    </div>
  );
}

// ── Chart section wrapper ──────────────────────────────────────────────────
function ChartCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--color-surface)", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border)", padding: "var(--spacing-6)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--spacing-5)" }}>
        <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700 }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

const TOOLTIP_STYLE = {
  background: "var(--color-surface)", border: "1px solid var(--color-border)",
  borderRadius: "8px", fontSize: "12px",
};

// ── SGK fatura tipi etiketi (TR/EN) ─────────────────────────────────────────
function sgkTypeLabel(type: string, lang: string): string {
  const up = type.toUpperCase().replace(/[\s-]/g, "_");
  if (up.includes("GROUP_A") || up.includes("GRUBU_A") || up.includes("A_GRUP")) return lang === "en" ? "Group A" : "A Grubu";
  if (up.includes("GROUP_B") || up.includes("GRUBU_B") || up.includes("B_GRUP")) return lang === "en" ? "Group B" : "B Grubu";
  if (up.includes("GROUP_C") || up.includes("GRUBU_C") || up.includes("C_GRUP")) return lang === "en" ? "Group C" : "C Grubu";
  return type.replace(/_/g, " ");
}

// ── Bu Ay vs Geçen Ay: değişim rozeti ───────────────────────────────────────
function MonthChangeBadge({ current, previous, changePct, invert }: {
  current: number; previous: number; changePct: number; invert?: boolean;
}) {
  const { lang } = useLangContext();

  // Geçen ay veri yoktu ama bu ay var — yüzde anlamsız, "Yeni" göster
  if (previous === 0) {
    if (current === 0) {
      return <span style={{ color: "var(--color-text-muted)", fontWeight: 700 }}>—</span>;
    }
    const favorable = !invert;
    return (
      <span style={{ color: favorable ? GREEN : RED, fontWeight: 700, whiteSpace: "nowrap" }}>
        ▲ {lang === "en" ? "New" : "Yeni"}
      </span>
    );
  }

  const favorable = invert ? changePct < 0 : changePct > 0;
  const color = changePct === 0 ? "var(--color-text-muted)" : favorable ? GREEN : RED;
  const arrow = changePct > 0 ? "▲" : changePct < 0 ? "▼" : "▬";
  return (
    <span style={{ color, fontWeight: 700, whiteSpace: "nowrap" }}>
      {arrow} %{Math.abs(changePct).toFixed(1)}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function DashboardClient({ data, pharmacistName }: {
  data: DashboardData;
  pharmacistName: string;
}) {
  const [exporting, setExporting] = useState(false);
  const { lang } = useLangContext();
  const d = t.dashboard;
  const c = t.common;

  const { summary, promissoryNotes, sgkVsCash, monthlyTrend, upcomingSgk, platformIncome,
          dailyAvgCiro, cashPosSplit, expenseBreakdown, urgentNotesCount, runway30, dayComparison, weekComparison, monthComparison } = data;

  const platformTotal = platformIncome.reduce((s, p) => s + p.amount, 0);
  const totalIncomeAll = sgkVsCash.cashTotal + sgkVsCash.sgkTotal + platformTotal;

  const sgkRatio = totalIncomeAll > 0 ? (sgkVsCash.sgkTotal / totalIncomeAll) * 100 : 0;

  const unpaidNotes = promissoryNotes.filter((n) => !n.isPaid);
  const unpaidTotal = unpaidNotes.reduce((s, n) => s + n.amount, 0);

  const posTotal = cashPosSplit.posTotal;
  const cashTotal = cashPosSplit.cashTotal;
  const cashPosAll = posTotal + cashTotal;
  const posRatio = cashPosAll > 0 ? (posTotal / cashPosAll) * 100 : 0;

  const runway30Net = runway30.projectedIncome - runway30.committedExpense;

  // Bu Ay vs Geçen Ay — karşılaştırma satırları
  const monthComparisonRows: Array<{
    label: string; labelEn: string;
    current: number; previous: number; changePct: number;
    invert?: boolean;
  }> = [
    { label: "POS", labelEn: "POS", ...monthComparison.pos },
    { label: "Nakit", labelEn: "Cash", ...monthComparison.cash },
    { label: "SGK Geliri", labelEn: "SGK Income", ...monthComparison.sgk },
    { label: "Platform Geliri", labelEn: "Platform Income", ...monthComparison.platform },
    { label: "Toplam Gelir", labelEn: "Total Income", ...monthComparison.totalIncome },
    { label: "Toplam Gider", labelEn: "Total Expense", ...monthComparison.totalExpense, invert: true },
    { label: "Net Kâr", labelEn: "Net Profit", ...monthComparison.netProfit },
  ];

  const [now] = useState(() => Date.now());
  const overdueUnpaid = unpaidNotes.filter(n => new Date(n.dueDate).getTime() < now);
  const urgentUnpaid = unpaidNotes.filter(n => {
    const t = new Date(n.dueDate).getTime();
    return t >= now && t <= now + 7 * 86400000;
  });
  const overdueAmount = overdueUnpaid.reduce((s, n) => s + n.amount, 0);
  const urgentAmount = urgentUnpaid.reduce((s, n) => s + n.amount, 0);

  // ── PDF Export ─────────────────────────────────────────────────────────
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { generateDashboardPdf } = await import("@/lib/pdf/generateDashboardPdf");
      await generateDashboardPdf(data, pharmacistName);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--spacing-8)", flexWrap: "wrap", gap: "var(--spacing-4)" }}>
        <div>
          <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "4px" }}>
            {tx(d.welcome, lang)}, {pharmacistName}! 👋
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            {new Date().toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "long", year: "numeric" })} · {tx(d.subtitle, lang)}
          </p>
        </div>
        <button
          onClick={() => void handleExportPdf()}
          disabled={exporting}
          className="btn btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}
        >
          {exporting ? (
            <><span className="spinner" style={{ width: 16, height: 16 }} /> {lang === "en" ? "Preparing PDF..." : "PDF Hazırlanıyor..."}</>
          ) : (
            <>📄 {tx(d.downloadPdf, lang)}</>
          )}
        </button>
      </div>

      {/* ── Kritik Uyarı Banneri ── */}
      {urgentNotesCount > 0 && (
        <div style={{
          background: "#fff5f5", border: "1px solid #feb2b2", borderRadius: "var(--radius-lg)",
          padding: "12px 18px", marginBottom: "var(--spacing-5)",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <span style={{ fontSize: "22px", flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, color: "#c53030", fontSize: "var(--font-size-sm)" }}>
              {lang === "en"
                ? `${urgentNotesCount} promissory note(s) due within 7 days!`
                : `${urgentNotesCount} senetin vadesi 7 gün içinde doluyor!`}
            </p>
            <p style={{ fontSize: "var(--font-size-xs)", color: "#e53e3e", marginTop: "2px" }}>
              {lang === "en" ? "Review your promissory notes immediately." : "Senetlerinizi hemen kontrol edin."}
            </p>
          </div>
          <a href="/finans/senet" style={{
            flexShrink: 0, padding: "6px 14px", borderRadius: "var(--radius-md)",
            background: "#e53e3e", color: "white", textDecoration: "none",
            fontSize: "var(--font-size-xs)", fontWeight: 700,
          }}>
            {lang === "en" ? "View Notes →" : "Senetlere Git →"}
          </a>
        </div>
      )}

      {/* ── Bugün vs Geçen Ayın Aynı Günü ── */}
      {dayComparison.hasData && (
        <div style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)", padding: "14px 18px", marginBottom: "var(--spacing-5)",
          display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap",
        }}>
          <span style={{ fontSize: "20px", flexShrink: 0 }}>📅</span>
          <div style={{ flex: 1, minWidth: 240 }}>
            <p style={{ fontSize: "var(--font-size-sm)", fontWeight: 700 }}>
              {lang === "en"
                ? `Today (${new Date(dayComparison.todayDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}) vs same day last month (${new Date(dayComparison.compareDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" })})`
                : `Bugün (${new Date(dayComparison.todayDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}) geçen ayın aynı günüyle (${new Date(dayComparison.compareDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}) kıyaslandı`}
            </p>
            <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "4px" }}>
              <span style={{ fontWeight: 700, color: dayComparison.posChangePct >= 0 ? GREEN : RED }}>
                POS {dayComparison.posChangePct >= 0
                  ? (lang === "en" ? "higher" : "yüksek")
                  : (lang === "en" ? "lower" : "düşük")} (%{Math.abs(dayComparison.posChangePct).toFixed(0)})
              </span>
              {"  ·  "}
              <span style={{ fontWeight: 700, color: dayComparison.cashChangePct >= 0 ? GREEN : RED }}>
                {lang === "en" ? "Cash" : "Nakit"} {dayComparison.cashChangePct >= 0
                  ? (lang === "en" ? "higher" : "yüksek")
                  : (lang === "en" ? "lower" : "düşük")} (%{Math.abs(dayComparison.cashChangePct).toFixed(0)})
              </span>
            </p>
          </div>
        </div>
      )}

      {/* ── Bu Hafta vs Geçen Hafta ── */}
      {weekComparison.hasData && (
        <div style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)", padding: "14px 18px", marginBottom: "var(--spacing-5)",
          display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap",
        }}>
          <span style={{ fontSize: "20px", flexShrink: 0 }}>🗓️</span>
          <div style={{ flex: 1, minWidth: 240 }}>
            <p style={{ fontSize: "var(--font-size-sm)", fontWeight: 700 }}>
              {lang === "en" ? "This week (last 7 days) vs previous week" : "Bu hafta (son 7 gün) geçen haftayla kıyaslandı"}
            </p>
            <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "4px" }}>
              <span style={{ fontWeight: 700, color: weekComparison.changePct >= 0 ? GREEN : RED }}>
                {lang === "en" ? "Weekly income" : "Haftalık ciro"} {weekComparison.changePct >= 0 ? "▲" : "▼"} %{Math.abs(weekComparison.changePct).toFixed(0)}
              </span>
              {"  ·  "}
              {formatCurrency(weekComparison.weekIncome)} {lang === "en" ? "vs" : "vs"} {formatCurrency(weekComparison.prevWeekIncome)}
            </p>
          </div>
        </div>
      )}

      {/* ── Bu Ay vs Geçen Ay ── */}
      <div style={{ marginBottom: "var(--spacing-5)" }}>
        <ChartCard title={lang === "en" ? "This Month vs Last Month" : "Bu Ay vs Geçen Ay"}>
          <div className="table-container" style={{ border: "none", boxShadow: "none" }}>
            <table className="table" style={{ width: "100%", fontSize: "13px" }}>
              <thead>
                <tr>
                  <th>{lang === "en" ? "Metric" : "Metrik"}</th>
                  <th>{lang === "en" ? "This Month" : "Bu Ay"}</th>
                  <th>{lang === "en" ? "Last Month" : "Geçen Ay"}</th>
                  <th>{lang === "en" ? "Change" : "Değişim"}</th>
                </tr>
              </thead>
              <tbody>
                {monthComparisonRows.map((row) => (
                  <tr key={row.label}>
                    <td style={{ fontWeight: 700 }}>{lang === "en" ? row.labelEn : row.label}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(row.current)}</td>
                    <td style={{ color: "var(--color-text-muted)" }}>{formatCurrency(row.previous)}</td>
                    <td>
                      <MonthChangeBadge
                        current={row.current}
                        previous={row.previous}
                        changePct={row.changePct}
                        invert={row.invert}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* ── Özet Kartlar ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }}>
        <StatCard label={tx(d.totalIncome, lang)} value={formatCurrency(summary.totalIncome)} change={summary.incomeChange} icon="📈" accent="income" />
        <StatCard label={tx(d.totalExpense, lang)} value={formatCurrency(summary.totalExpense)} change={summary.expenseChange} icon="📉" accent="expense" />
        <StatCard label={tx(d.netProfit, lang)} value={formatCurrency(summary.netProfit)} icon="💰" accent="profit" />
        <StatCard
          label={lang === "en" ? "Daily Avg. Sales" : "Günlük Ort. Ciro"}
          value={formatCurrency(dailyAvgCiro)}
          icon="📊"
          accent="income"
        />
        <StatCard
          label={tx(d.unpaidNote, lang)}
          value={unpaidNotes.length > 0 ? formatCurrency(unpaidTotal) : tx(d.none, lang)}
          icon="📄"
          accent={unpaidNotes.length > 0 ? "expense" : "profit"}
        />
      </div>

      {/* ── Ana Grid (trend + SGK pasta) ── */}
      <div className="responsive-grid responsive-grid-2-1" style={{ gap: "var(--spacing-5)", marginBottom: "var(--spacing-5)" }}>
        {/* Aylık Trend */}
        <ChartCard title={tx(d.trend, lang)}>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="gGelir" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GREEN} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gGider" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={RED} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={RED} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={((v: number) => formatCurrency(v)) as AnyFmt} contentStyle={TOOLTIP_STYLE} />
                <Legend formatter={(v) => v === "gelir" ? tx(d.income, lang) : v === "gider" ? tx(d.expense, lang) : tx(d.profit, lang)} />
                <Area type="monotone" dataKey="gelir" stroke={GREEN} fill="url(#gGelir)" strokeWidth={2} />
                <Area type="monotone" dataKey="gider" stroke={RED} fill="url(#gGider)" strokeWidth={2} />
                <Area type="monotone" dataKey="kar" stroke={BLUE} fill="none" strokeWidth={2} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Gelir Kaynakları */}
        <ChartCard title={lang === "en" ? "Income Breakdown" : "Gelir Kaynakları"}>
          {totalIncomeAll === 0 ? (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", textAlign: "center" }}>
                {lang === "en" ? "No income data for this month." : "Bu ay gelir kaydı bulunamadı."}
              </p>
            </div>
          ) : (
            <>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: lang === "en" ? "Daily Sales" : "Kasa", value: sgkVsCash.cashTotal },
                        { name: "SGK", value: sgkVsCash.sgkTotal },
                        { name: lang === "en" ? "Platform" : "Platform", value: platformTotal },
                      ].filter(d => d.value > 0)}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
                    >
                      <Cell fill={GREEN} />
                      <Cell fill={BLUE} />
                      <Cell fill={ORANGE} />
                    </Pie>
                    <Tooltip formatter={((v: number) => formatCurrency(v)) as AnyFmt} contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p style={{ textAlign: "center", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "var(--spacing-2)" }}>
                {lang === "en" ? `SGK share: ${sgkRatio.toFixed(0)}%` : `SGK Oranı: %${sgkRatio.toFixed(0)}`}
              </p>
            </>
          )}
        </ChartCard>
      </div>

      {/* ── Platform Geliri + Yaklaşan SGK ── */}
      <div className={`responsive-grid ${platformIncome.length > 0 ? "responsive-grid-1-1" : ""}`} style={{ gridTemplateColumns: platformIncome.length > 0 ? undefined : "1fr", gap: "var(--spacing-5)", marginBottom: "var(--spacing-5)" }}>
        {/* Platform gelirleri — gizle eğer kayıt yoksa */}
        {platformIncome.length > 0 && (
          <ChartCard title={tx(d.platformIncome, lang)}>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformIncome} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="platformName" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={((v: number) => formatCurrency(v)) as AnyFmt} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="amount" fill={GREEN_LIGHT} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}

        {/* Yaklaşan SGK ödemeleri */}
        <ChartCard title={tx(d.upcomingSgk, lang)}>
          {upcomingSgk.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "32px" }}>{tx(d.noUpcoming, lang)}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
              {upcomingSgk.slice(0, 5).map((item) => (
                <div key={item.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "var(--spacing-3) var(--spacing-4)",
                  background: "var(--color-bg)", borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{sgkTypeLabel(item.invoiceType, lang)}</p>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                      {new Date(item.expectedPaymentDate).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR")} {lang === "en" ? "est." : "tahmini"}
                    </p>
                  </div>
                  <span style={{ fontWeight: 700, color: GREEN, fontSize: "var(--font-size-sm)" }}>
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Analitik Satırı: Gider Dağılımı + Nakit/POS + 30 Günlük Pist ── */}
      <div className="responsive-grid responsive-grid-1-1-1" style={{ gap: "var(--spacing-5)", marginBottom: "var(--spacing-5)" }}>
        {/* Gider Dağılımı Donut */}
        <ChartCard title={lang === "en" ? "Expense Breakdown" : "Gider Dağılımı"}>
          {expenseBreakdown.length === 0 ? (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", textAlign: "center" }}>
                {lang === "en" ? "No expense data." : "Bu ay gider kaydı yok."}
              </p>
            </div>
          ) : (
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseBreakdown.map(e => ({ ...e, name: lang === "en" ? e.nameEn : e.name }))}
                    cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {expenseBreakdown.map((_, i) => (
                      <Cell key={i} fill={[RED, ORANGE, BLUE][i % 3]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={((v: number) => formatCurrency(v)) as AnyFmt} contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(v) => v} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Nakit / POS Oranı */}
        <ChartCard title={lang === "en" ? "Cash vs POS" : "Nakit / POS Oranı"}>
          {cashPosAll === 0 ? (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", textAlign: "center" }}>
                {lang === "en" ? "No sales data." : "Bu ay kasa kaydı yok."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)", paddingTop: "var(--spacing-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)" }}>
                <span style={{ color: "var(--color-text-muted)" }}>POS</span>
                <span style={{ fontWeight: 700 }}>{formatCurrency(posTotal)} <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>%{posRatio.toFixed(0)}</span></span>
              </div>
              <div style={{ height: 10, background: "var(--color-border)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${posRatio}%`, background: BLUE, borderRadius: "var(--radius-full)", transition: "width 0.5s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)" }}>
                <span style={{ color: "var(--color-text-muted)" }}>{lang === "en" ? "Cash" : "Nakit"}</span>
                <span style={{ fontWeight: 700 }}>{formatCurrency(cashTotal)} <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>%{(100 - posRatio).toFixed(0)}</span></span>
              </div>
              <div style={{ height: 10, background: "var(--color-border)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${100 - posRatio}%`, background: GREEN, borderRadius: "var(--radius-full)", transition: "width 0.5s ease" }} />
              </div>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textAlign: "center", marginTop: "4px" }}>
                {lang === "en" ? `Total sales: ${formatCurrency(cashPosAll)}` : `Toplam ciro: ${formatCurrency(cashPosAll)}`}
              </p>
            </div>
          )}
        </ChartCard>

        {/* 30 Günlük Nakit Pist */}
        <ChartCard title={lang === "en" ? "30-Day Outlook" : "30 Günlük Tahmini"}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)", paddingTop: "var(--spacing-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                {lang === "en" ? "Projected income" : "Tahmini gelir"}
              </span>
              <span style={{ fontWeight: 700, color: GREEN, fontSize: "var(--font-size-sm)" }}>{formatCurrency(runway30.projectedIncome)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                {lang === "en" ? "Committed expense" : "Taahhüt edilen gider"}
              </span>
              <span style={{ fontWeight: 700, color: RED, fontSize: "var(--font-size-sm)" }}>{formatCurrency(runway30.committedExpense)}</span>
            </div>
            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>
                {lang === "en" ? "Projected net" : "Tahmini net"}
              </span>
              <span style={{ fontWeight: 800, fontSize: "var(--font-size-base)", color: runway30Net >= 0 ? GREEN : RED }}>
                {formatCurrency(runway30Net)}
              </span>
            </div>
            <div style={{ height: 8, background: "var(--color-border)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, runway30.projectedIncome > 0 ? (runway30.committedExpense / runway30.projectedIncome) * 100 : 100)}%`,
                background: runway30Net >= 0 ? GREEN : RED,
                borderRadius: "var(--radius-full)", transition: "width 0.5s ease",
              }} />
            </div>
            <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textAlign: "center" }}>
              {lang === "en" ? "Based on daily avg. sales" : "Günlük ortalama ciro baz alındı"}
            </p>
          </div>
        </ChartCard>
      </div>

      {/* ── Senetler ── */}
      {unpaidNotes.length > 0 && (
        <ChartCard title={lang === "en" ? `Upcoming Notes (${unpaidNotes.length} · ${formatCurrency(unpaidTotal)})` : `Yaklaşan Senetler (${unpaidNotes.length} adet · ${formatCurrency(unpaidTotal)})`}>
          {/* Progress bar — urgency indicator */}
          <div style={{ marginBottom: "var(--spacing-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "6px" }}>
              <span style={{ color: overdueUnpaid.length > 0 ? RED : "var(--color-text-muted)" }}>
                {lang === "en" ? "Overdue" : "Gecikmiş"}: {overdueUnpaid.length}
              </span>
              <span style={{ color: urgentUnpaid.length > 0 ? ORANGE : "var(--color-text-muted)" }}>
                {lang === "en" ? "Due this week" : "Bu hafta"}: {urgentUnpaid.length}
              </span>
              <span>{lang === "en" ? "Upcoming" : "Gelecek"}: {unpaidNotes.length - overdueUnpaid.length - urgentUnpaid.length}</span>
            </div>
            {/* Segmented urgency bar */}
            <div style={{ height: 8, background: "var(--color-border)", borderRadius: "var(--radius-full)", overflow: "hidden", display: "flex" }}>
              {unpaidTotal > 0 && overdueAmount > 0 && (
                <div style={{ height: "100%", width: `${(overdueAmount / unpaidTotal) * 100}%`, background: RED, flexShrink: 0 }} />
              )}
              {unpaidTotal > 0 && urgentAmount > 0 && (
                <div style={{ height: "100%", width: `${(urgentAmount / unpaidTotal) * 100}%`, background: ORANGE, flexShrink: 0 }} />
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-2)" }}>
            {unpaidNotes.slice(0, 6).map((note) => {
              const due = new Date(note.dueDate);
              const daysLeft = Math.ceil((due.getTime() - now) / 86400000);
              const urgent = daysLeft <= 7;
              return (
                <div key={note.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "var(--spacing-3) var(--spacing-4)",
                  background: urgent ? "var(--color-danger-bg)" : "var(--color-bg)",
                  borderRadius: "var(--radius-md)",
                  border: `1px solid ${urgent ? "var(--color-danger-border)" : "var(--color-border)"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-3)" }}>
                    <span style={{ fontSize: "16px" }}>{urgent ? "⚠️" : "📄"}</span>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{lang === "en" ? "Note" : "Senet"} #{note.noteNumber}</p>
                      <p style={{ fontSize: "var(--font-size-xs)", color: urgent ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                        {due.toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR")} · {daysLeft <= 0 ? (lang === "en" ? "Overdue!" : "Süresi geçti!") : (lang === "en" ? `${daysLeft} days left` : `${daysLeft} gün kaldı`)}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, color: urgent ? "var(--color-danger)" : "var(--color-text)", fontSize: "var(--font-size-sm)" }}>
                    {formatCurrency(note.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
