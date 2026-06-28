"use client";

import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

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
          {change > 0 ? "▲" : "▼"} %{Math.abs(change).toFixed(1)} geçen aya göre
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

// ── Main component ─────────────────────────────────────────────────────────
export default function DashboardClient({ data, pharmacistName }: {
  data: DashboardData;
  pharmacistName: string;
}) {
  const [exporting, setExporting] = useState(false);

  const { summary, promissoryNotes, sgkVsCash, monthlyTrend, upcomingSgk, platformIncome } = data;

  const sgkRatio = sgkVsCash.sgkTotal + sgkVsCash.cashTotal > 0
    ? (sgkVsCash.sgkTotal / (sgkVsCash.sgkTotal + sgkVsCash.cashTotal)) * 100
    : 0;

  const unpaidNotes = promissoryNotes.filter((n) => !n.isPaid);
  const unpaidTotal = unpaidNotes.reduce((s, n) => s + n.amount, 0);

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
            Hoş Geldiniz, {pharmacistName}! 👋
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            {new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })} · Aylık Finansal Özet
          </p>
        </div>
        <button
          onClick={() => void handleExportPdf()}
          disabled={exporting}
          className="btn btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}
        >
          {exporting ? (
            <><span className="spinner" style={{ width: 16, height: 16 }} /> PDF Hazırlanıyor...</>
          ) : (
            <>📄 PDF Olarak İndir</>
          )}
        </button>
      </div>

      {/* ── Özet Kartlar ── */}
      <div className="grid-4 stat-grid" style={{ gap: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }}>
        <StatCard label="Bu Ay Toplam Gelir" value={formatCurrency(summary.totalIncome)} change={summary.incomeChange} icon="📈" accent="income" />
        <StatCard label="Bu Ay Toplam Gider" value={formatCurrency(summary.totalExpense)} change={summary.expenseChange} icon="📉" accent="expense" />
        <StatCard label="Net Kâr" value={formatCurrency(summary.netProfit)} icon="💰" accent="profit" />
        <StatCard
          label="Ödenmemiş Senet"
          value={unpaidNotes.length > 0 ? formatCurrency(unpaidTotal) : "Yok"}
          icon="📄"
          accent={unpaidNotes.length > 0 ? "expense" : "profit"}
        />
      </div>

      {/* ── Ana Grid (trend + SGK pasta) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--spacing-5)", marginBottom: "var(--spacing-5)" }}>
        {/* Aylık Trend */}
        <ChartCard title="Aylık Gelir / Gider / Kâr Trendi">
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
                <Legend formatter={(v) => v === "gelir" ? "Gelir" : v === "gider" ? "Gider" : "Kâr"} />
                <Area type="monotone" dataKey="gelir" stroke={GREEN} fill="url(#gGelir)" strokeWidth={2} />
                <Area type="monotone" dataKey="gider" stroke={RED} fill="url(#gGider)" strokeWidth={2} />
                <Area type="monotone" dataKey="kar" stroke={BLUE} fill="none" strokeWidth={2} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* SGK vs Elden */}
        <ChartCard title="SGK / Elden Satış Oranı">
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[
                  { name: "SGK", value: sgkVsCash.sgkTotal },
                  { name: "Elden (POS/Nakit)", value: sgkVsCash.cashTotal },
                ]} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  <Cell fill={GREEN} />
                  <Cell fill={ORANGE} />
                </Pie>
                <Tooltip formatter={((v: number) => formatCurrency(v)) as AnyFmt} contentStyle={TOOLTIP_STYLE} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p style={{ textAlign: "center", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "var(--spacing-2)" }}>
            SGK oranı: <strong>%{sgkRatio.toFixed(0)}</strong>
          </p>
        </ChartCard>
      </div>

      {/* ── Platform Geliri + Yaklaşan SGK ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-5)", marginBottom: "var(--spacing-5)" }}>
        {/* Platform gelirleri */}
        <ChartCard title="Platform Gelirleri (Bu Ay)">
          {platformIncome.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "32px" }}>Henüz kayıt yok</p>
          ) : (
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
          )}
        </ChartCard>

        {/* Yaklaşan SGK ödemeleri */}
        <ChartCard title="Yaklaşan SGK Ödemeleri">
          {upcomingSgk.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "32px" }}>Yaklaşan SGK ödemesi yok</p>
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
                    <p style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{item.invoiceType.replace(/_/g, " ")}</p>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                      {new Date(item.expectedPaymentDate).toLocaleDateString("tr-TR")} tahmini
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

      {/* ── Senetler ── */}
      {unpaidNotes.length > 0 && (
        <ChartCard title={`Yaklaşan Senetler (${unpaidNotes.length} adet · ${formatCurrency(unpaidTotal)})`}>
          {/* Progress bar */}
          <div style={{ marginBottom: "var(--spacing-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "6px" }}>
              <span>Ödenen: {promissoryNotes.filter(n => n.isPaid).length}</span>
              <span>Ödenecek: {unpaidNotes.length}</span>
            </div>
            <div style={{ height: 8, background: "var(--color-border)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${(promissoryNotes.filter(n => n.isPaid).length / promissoryNotes.length) * 100}%`,
                background: GREEN, borderRadius: "var(--radius-full)",
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-2)" }}>
            {unpaidNotes.slice(0, 6).map((note) => {
              const due = new Date(note.dueDate);
              const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
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
                      <p style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>Senet #{note.noteNumber}</p>
                      <p style={{ fontSize: "var(--font-size-xs)", color: urgent ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                        {due.toLocaleDateString("tr-TR")} · {daysLeft <= 0 ? "Süresi geçti!" : `${daysLeft} gün kaldı`}
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
