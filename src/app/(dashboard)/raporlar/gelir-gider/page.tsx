"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFmt = (...args: any[]) => any;

interface ReportData {
  period: { start: string; end: string };
  summary: { totalIncome: number; totalExpense: number; netProfit: number };
  monthly: Array<{ month: string; gelir: number; gider: number; kar: number; kasa: number; sgk: number; platform: number; sabitGider: number; personelGider: number }>;
  incomeBySource: { kasa: number; sgk: number; platform: number };
  expenseByType: Record<string, number>;
  platformByName: Record<string, number>;
  promissoryNotes: Array<{ dueDate: string; amount: number; isPaid: boolean; noteNumber: string }>;
}

const INCOME_COLORS = ["#4e7c3f", "#3498db", "#9fe870"];
const EXPENSE_COLORS = ["#e74c3c", "#e67e22", "#c0392b", "#f39c12", "#d35400", "#8e44ad", "#2c3e50"];
const TT = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" };

const fmt = (v: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(v);

const PRESETS = [
  { label: "Bu Ay", fn: () => { const n = new Date(); return { start: new Date(n.getFullYear(), n.getMonth(), 1), end: new Date() }; } },
  { label: "Son 3 Ay", fn: () => { const n = new Date(); return { start: new Date(n.getFullYear(), n.getMonth() - 2, 1), end: new Date() }; } },
  { label: "Son 6 Ay", fn: () => { const n = new Date(); return { start: new Date(n.getFullYear(), n.getMonth() - 5, 1), end: new Date() }; } },
  { label: "Bu Yıl", fn: () => ({ start: new Date(new Date().getFullYear(), 0, 1), end: new Date() }) },
];

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-5)", borderTop: `3px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-2)" }}>
        <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: "20px" }}>{icon}</span>
      </div>
      <p style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color }}>{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
      <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-5)" }}>{title}</h3>
      {children}
    </div>
  );
}

export default function GelirGiderPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState(2); // Son 6 Ay default
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const fetchReport = useCallback(async (start: Date, end: Date) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/raporlar/ozet?start=${start.toISOString()}&end=${end.toISOString()}`);
      const json = await res.json() as { success: boolean; data?: ReportData };
      if (json.success && json.data) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const preset = PRESETS[activePreset];
    const { start, end } = preset.fn();
    void fetchReport(start, end);
  }, [activePreset, fetchReport]);

  const handleCustom = () => {
    if (!customStart || !customEnd) return;
    void fetchReport(new Date(customStart), new Date(customEnd));
  };

  const incomePieData = data ? [
    { name: "Kasa (POS/Nakit)", value: data.incomeBySource.kasa },
    { name: "SGK", value: data.incomeBySource.sgk },
    { name: "Platform", value: data.incomeBySource.platform },
  ].filter(d => d.value > 0) : [];

  const expensePieData = data ? Object.entries(data.expenseByType)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value) : [];

  const topPlatforms = data ? Object.entries(data.platformByName)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value) : [];

  return (
    <main className="page-content">
      {/* Başlık + Filtreler */}
      <div style={{ marginBottom: "var(--spacing-6)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "var(--spacing-2)" }}>Gelir - Gider Raporu</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>Tüm gelir kaynaklarınızı ve giderlerinizi dönemsel olarak analiz edin.</p>
      </div>

      {/* Dönem Seçici */}
      <div style={{ display: "flex", gap: "var(--spacing-2)", flexWrap: "wrap", marginBottom: "var(--spacing-6)", alignItems: "center" }}>
        {PRESETS.map((p, i) => (
          <button key={p.label} onClick={() => { setActivePreset(i); setShowCustom(false); }}
            className={`btn ${activePreset === i && !showCustom ? "btn-primary" : "btn-ghost"}`}
            style={{ fontSize: "var(--font-size-sm)", padding: "8px 16px" }}>
            {p.label}
          </button>
        ))}
        <button onClick={() => setShowCustom(v => !v)}
          className={`btn ${showCustom ? "btn-primary" : "btn-ghost"}`}
          style={{ fontSize: "var(--font-size-sm)", padding: "8px 16px" }}>
          📅 Özel Aralık
        </button>
        {showCustom && (
          <div style={{ display: "flex", gap: "var(--spacing-2)", alignItems: "center" }}>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="form-input" style={{ width: 140, fontSize: "var(--font-size-sm)", padding: "8px" }} />
            <span style={{ color: "var(--color-text-muted)" }}>—</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="form-input" style={{ width: 140, fontSize: "var(--font-size-sm)", padding: "8px" }} />
            <button onClick={handleCustom} className="btn btn-primary" style={{ padding: "8px 14px", fontSize: "var(--font-size-sm)" }}>Uygula</button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "80px" }}><div className="spinner" style={{ margin: "0 auto" }} /></div>
      ) : !data ? (
        <p style={{ color: "var(--color-text-muted)" }}>Veri yüklenemedi.</p>
      ) : (
        <>
          {/* Özet Kartlar */}
          <div className="grid-3" style={{ marginBottom: "var(--spacing-5)" }}>
            <SummaryCard label="Toplam Gelir" value={fmt(data.summary.totalIncome)} icon="📈" color="#4e7c3f" />
            <SummaryCard label="Toplam Gider" value={fmt(data.summary.totalExpense)} icon="📉" color="#e74c3c" />
            <SummaryCard label="Net Kâr" value={fmt(data.summary.netProfit)} icon="💰"
              color={data.summary.netProfit >= 0 ? "#3498db" : "#e74c3c"} />
          </div>

          {/* Aylık Trend */}
          <div style={{ marginBottom: "var(--spacing-5)" }}>
            <ChartCard title="Aylık Gelir / Gider / Kâr Trendi">
              {data.monthly.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "40px" }}>Bu dönemde kayıt yok.</p>
              ) : (
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.monthly} margin={{ left: 10, right: 10, top: 4, bottom: 4 }}>
                      <defs>
                        <linearGradient id="gGelir" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4e7c3f" stopOpacity={0.25} /><stop offset="95%" stopColor="#4e7c3f" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gGider" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#e74c3c" stopOpacity={0.2} /><stop offset="95%" stopColor="#e74c3c" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={((v: number) => fmt(v)) as AnyFmt} contentStyle={TT} />
                      <Legend formatter={(v: string) => ({ gelir: "Gelir", gider: "Gider", kar: "Kâr" }[v] ?? v)} />
                      <Area type="monotone" dataKey="gelir" stroke="#4e7c3f" fill="url(#gGelir)" strokeWidth={2} />
                      <Area type="monotone" dataKey="gider" stroke="#e74c3c" fill="url(#gGider)" strokeWidth={2} />
                      <Area type="monotone" dataKey="kar" stroke="#3498db" fill="none" strokeWidth={2} strokeDasharray="4 2" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          </div>

          {/* Gelir Kaynaklari + Gider Kalemleri */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-5)", marginBottom: "var(--spacing-5)" }}>
            <ChartCard title="Gelir Kaynakları">
              {incomePieData.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "40px" }}>Bu dönemde gelir yok.</p>
              ) : (
                <>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={incomePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                          {incomePieData.map((_, i) => <Cell key={i} fill={INCOME_COLORS[i % INCOME_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={((v: number) => fmt(v)) as AnyFmt} contentStyle={TT} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "var(--spacing-3)" }}>
                    {incomePieData.map((d, i) => {
                      const total = incomePieData.reduce((s, x) => s + x.value, 0);
                      return (
                        <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--font-size-sm)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: INCOME_COLORS[i % INCOME_COLORS.length], flexShrink: 0 }} />
                            <span>{d.name}</span>
                          </div>
                          <div style={{ display: "flex", gap: "12px" }}>
                            <span style={{ color: "var(--color-text-muted)" }}>%{total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}</span>
                            <span style={{ fontWeight: 700 }}>{fmt(d.value)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </ChartCard>

            <ChartCard title="Gider Kalemleri">
              {expensePieData.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "40px" }}>Bu dönemde gider yok.</p>
              ) : (
                <>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={expensePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                          {expensePieData.map((_, i) => <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={((v: number) => fmt(v)) as AnyFmt} contentStyle={TT} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "var(--spacing-3)" }}>
                    {expensePieData.slice(0, 6).map((d, i) => {
                      const total = expensePieData.reduce((s, x) => s + x.value, 0);
                      return (
                        <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--font-size-sm)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: EXPENSE_COLORS[i % EXPENSE_COLORS.length], flexShrink: 0 }} />
                            <span style={{ textTransform: "capitalize" }}>{d.name.replace(/_/g, " ").toLowerCase()}</span>
                          </div>
                          <div style={{ display: "flex", gap: "12px" }}>
                            <span style={{ color: "var(--color-text-muted)" }}>%{total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}</span>
                            <span style={{ fontWeight: 700 }}>{fmt(d.value)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </ChartCard>
          </div>

          {/* Platform Gelirleri + Senet Özeti */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-5)", marginBottom: "var(--spacing-5)" }}>
            {topPlatforms.length > 0 && (
              <ChartCard title="Platform Gelirleri Karşılaştırması">
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topPlatforms} layout="vertical" margin={{ left: 10, right: 40, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={((v: number) => fmt(v)) as AnyFmt} contentStyle={TT} />
                      <Bar dataKey="value" fill="#9fe870" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            )}

            <ChartCard title="Aylık Gider Kırılımı">
              {data.monthly.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "40px" }}>Veri yok.</p>
              ) : (
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthly} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={((v: number) => fmt(v)) as AnyFmt} contentStyle={TT} />
                      <Legend formatter={(v: string) => ({ sabitGider: "Sabit Gider", personelGider: "Personel" }[v] ?? v)} />
                      <Bar dataKey="sabitGider" stackId="g" fill="#e74c3c" />
                      <Bar dataKey="personelGider" stackId="g" fill="#c0392b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          </div>

          {/* Aylık Tablo */}
          {data.monthly.length > 0 && (
            <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
              <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>Aylık Detay Tablosu</h3>
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th>Ay</th>
                      <th style={{ textAlign: "right" }}>Kasa</th>
                      <th style={{ textAlign: "right" }}>SGK</th>
                      <th style={{ textAlign: "right" }}>Platform</th>
                      <th style={{ textAlign: "right" }}>Toplam Gelir</th>
                      <th style={{ textAlign: "right" }}>Toplam Gider</th>
                      <th style={{ textAlign: "right" }}>Net Kâr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.map(m => (
                      <tr key={m.month}>
                        <td style={{ fontWeight: 600 }}>{m.month}</td>
                        <td style={{ textAlign: "right" }}>{fmt(m.kasa)}</td>
                        <td style={{ textAlign: "right" }}>{fmt(m.sgk)}</td>
                        <td style={{ textAlign: "right" }}>{fmt(m.platform)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "#4e7c3f" }}>{fmt(m.gelir)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "#e74c3c" }}>{fmt(m.gider)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: m.kar >= 0 ? "#3498db" : "#e74c3c" }}>{fmt(m.kar)}</td>
                      </tr>
                    ))}
                    {/* Toplam satırı */}
                    <tr style={{ background: "var(--color-bg)", fontWeight: 800, borderTop: "2px solid var(--color-border)" }}>
                      <td>TOPLAM</td>
                      <td style={{ textAlign: "right" }}>{fmt(data.monthly.reduce((s, m) => s + m.kasa, 0))}</td>
                      <td style={{ textAlign: "right" }}>{fmt(data.monthly.reduce((s, m) => s + m.sgk, 0))}</td>
                      <td style={{ textAlign: "right" }}>{fmt(data.monthly.reduce((s, m) => s + m.platform, 0))}</td>
                      <td style={{ textAlign: "right", color: "#4e7c3f" }}>{fmt(data.summary.totalIncome)}</td>
                      <td style={{ textAlign: "right", color: "#e74c3c" }}>{fmt(data.summary.totalExpense)}</td>
                      <td style={{ textAlign: "right", color: data.summary.netProfit >= 0 ? "#3498db" : "#e74c3c" }}>{fmt(data.summary.netProfit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
