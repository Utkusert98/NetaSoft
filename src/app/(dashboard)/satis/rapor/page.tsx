"use client";

import { useState, useEffect, useMemo } from "react";
import { useLangContext } from "@/app/providers/LangProvider";
import { format } from "date-fns";
import { tr, enUS } from "date-fns/locale";
import { mapRow, isColumnMapConfident, type ParsedSaleRow, type ColumnMap, type ColumnOverride } from "@/lib/sales/mapRow";
import { parseSalesFileClient, isClientParseable } from "@/lib/sales/parseFile";
import { aggregateByStaff, hasStaffData, aggregateByDayOfWeek, aggregatePeriodTrend } from "@/lib/sales/aggregations";
import { topNWithOther } from "@/lib/utils/inventory-analysis";
import { DATE_RANGE_PRESETS, matchPreset, saleRowsDateSpan } from "@/lib/sales/dateRanges";
import DateRangePicker from "@/components/ui/DateRangePicker";
import PeriodRevenueWidget from "@/components/ui/PeriodRevenueWidget";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { ChartFormatter } from "@/lib/utils/chartTypes";


const CHART_COLORS = ["#4e7c3f", "#6aaa58", "#9ec97a", "#f5a623", "#e74c3c", "#3498db", "#9b59b6", "#1abc9c"];
const PIE_COLORS = ["#4e7c3f", "#1565c0"];

interface SaleRecord extends ParsedSaleRow { id: string }

interface SaleSummary {
  totalRecords: number;
  totalRevenue: number;
  prescriptionCount: number;
  retailCount: number;
  prescriptionRevenue: number;
  retailRevenue: number;
  byGroup: Record<string, number>;
  byGroupQuantity?: Record<string, number>;
}

const fmt = (v: number) => v.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

// `saleDate` sunucuda/DB'de HER ZAMAN UTC gece yarısı (T00:00:00.000Z) olarak
// saklanır (bkz. mapRow.ts::parseDate). `new Date(isoString)` ile ayrıştırıp
// ardından date-fns `format()` (yerel saat bileşenlerini okur) kullanmak,
// tarayıcının yerel saat dilimi UTC'den GERİ ise (ör. Amerika) günün BİR ÖNCEKİ
// güne kaymasına yol açar — grafik/tarih etiketleri gerçek satış gününden farklı
// gösterilir. Bu fonksiyon "YYYY-MM-DD" kısmını doğrudan YEREL bir Date'e
// (saat dilimi belirsizliği olmadan) çevirerek bu kaymayı önler.
const parseDateOnlyLocal = (isoOrDateOnly: string): Date => {
  const [y, m, d] = isoOrDateOnly.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const badge = (t: string, lang: string) => ({
  PRESCRIPTION: { bg: "#e8f5e9", color: "#2e7d32", label: lang === "en" ? "Prescription" : "Reçeteli" },
  RETAIL: { bg: "#e3f2fd", color: "#1565c0", label: lang === "en" ? "Retail" : "Perakende" },
}[t] ?? { bg: "#f5f5f5", color: "#555", label: t });

type UploadStep = "select" | "mapping" | "preview";

function DrillDownModal({ title, records, lang, onClose }: {
  title: string;
  records: SaleRecord[];
  lang: string;
  onClose: () => void;
}) {
  const en = lang === "en";
  const totalQty = records.reduce((s, r) => s + r.quantity, 0);
  const totalRevenue = records.reduce((s, r) => s + r.netRevenue, 0);
  const shown = records.slice(0, 200);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
      <div className="card" style={{ width: "100%", maxWidth: "800px", maxHeight: "85vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontWeight: 700, fontSize: "15px" }}>{title}</h3>
          <button className="btn" onClick={onClose} style={{ padding: "4px 10px", fontSize: "13px" }}>
            {en ? "Close" : "Kapat"}
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>
          <table className="table" style={{ width: "100%", fontSize: "13px" }}>
            <thead style={{ position: "sticky", top: 0, background: "var(--color-surface)" }}>
              <tr>
                <th>{en ? "Date" : "Tarih"}</th>
                <th>{en ? "Product Name" : "Ürün Adı"}</th>
                <th>{en ? "Group" : "Grup"}</th>
                <th>{en ? "Qty" : "Adet"}</th>
                <th>{en ? "Net Revenue" : "Net Gelir"}</th>
                <th>{en ? "Type" : "Tip"}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const b = badge(r.saleType, lang);
                return (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{format(parseDateOnlyLocal(r.saleDate), "dd MMM yyyy", { locale: en ? enUS : tr })}</td>
                    <td style={{ fontWeight: 500 }}>{r.productName}</td>
                    <td style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{r.productGroup}</td>
                    <td>{r.quantity}</td>
                    <td style={{ fontWeight: 700 }}>{r.netRevenue.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span style={{ padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 600, background: b.bg, color: b.color }}>
                        {b.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {records.length > 200 && (
            <div style={{ padding: "10px 18px", color: "var(--color-text-muted)", fontSize: "13px", borderTop: "1px solid var(--color-border)" }}>
              {en
                ? `+ ${(records.length - 200).toLocaleString("tr-TR")} more rows`
                : `+ ${(records.length - 200).toLocaleString("tr-TR")} satır daha`}
            </div>
          )}
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--color-border)", display: "flex", gap: "24px", fontSize: "13px", fontWeight: 600 }}>
          <span>{en ? "Total Qty" : "Toplam Adet"}: {totalQty.toLocaleString("tr-TR")}</span>
          <span>{en ? "Total Revenue" : "Toplam Gelir"}: {fmt(totalRevenue)}</span>
        </div>
      </div>
    </div>
  );
}

function DailyRevenueChart({ data, lang, onPointClick }: {
  data: Array<{ date: string; label: string; revenue: number; prescriptionRevenue: number; retailRevenue: number }>;
  lang: string;
  onPointClick: (date: string) => void;
}) {
  const en = lang === "en";
  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
          <YAxis domain={[0, "auto"]} allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => formatCurrency(v)} />
          <Tooltip
            formatter={((value: string | number | undefined, name: string | number | undefined) => {
              const label = name === "prescriptionRevenue" ? (en ? "Prescription" : "Reçeteli")
                : name === "retailRevenue" ? (en ? "Retail" : "Perakende")
                : (en ? "Total Revenue" : "Toplam Ciro");
              return [formatCurrency(Number(value ?? 0)), label];
            }) as ChartFormatter}
            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
          />
          <Legend formatter={(value: string) =>
            value === "prescriptionRevenue" ? (en ? "Prescription" : "Reçeteli")
              : value === "retailRevenue" ? (en ? "Retail" : "Perakende")
              : (en ? "Total Revenue" : "Toplam Ciro")} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke={CHART_COLORS[0]}
            strokeWidth={2}
            dot={{ r: 3, cursor: "pointer" }}
            activeDot={{ r: 5, cursor: "pointer" }}
            onClick={(point: unknown) => {
              const p = point as { payload?: { date: string } };
              if (p?.payload?.date) onPointClick(p.payload.date);
            }}
          />
          <Line type="monotone" dataKey="prescriptionRevenue" stroke={PIE_COLORS[0]} strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
          <Line type="monotone" dataKey="retailRevenue" stroke={PIE_COLORS[1]} strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TypeDistributionPieChart({ prescriptionRevenue, retailRevenue, lang, onSliceClick }: {
  prescriptionRevenue: number;
  retailRevenue: number;
  lang: string;
  onSliceClick: (type: "PRESCRIPTION" | "RETAIL") => void;
}) {
  const en = lang === "en";
  const total = prescriptionRevenue + retailRevenue;
  const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0;
  const data = [
    { name: en ? "Prescription (SGK)" : "Reçeteli (SGK)", value: prescriptionRevenue, type: "PRESCRIPTION" as const, pct: pct(prescriptionRevenue) },
    { name: en ? "Retail" : "Perakende", value: retailRevenue, type: "RETAIL" as const, pct: pct(retailRevenue) },
  ];
  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={4}
            dataKey="value"
            label={((entry: { name?: string; pct?: number }) => `${entry.name} %${entry.pct}`) as unknown as ChartFormatter}
            labelLine={false}
            onClick={(entry: unknown) => {
              const e = entry as { type?: "PRESCRIPTION" | "RETAIL" };
              if (e?.type) onSliceClick(e.type);
            }}
            style={{ cursor: "pointer" }}
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
          <Legend formatter={((value: string, entry: { payload?: { pct: number } }) => `${value} (%${entry?.payload?.pct ?? 0})`) as ChartFormatter} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopProductsChart({ data, lang, onBarClick }: {
  data: Array<{ name: string; quantity: number; revenue: number }>;
  lang: string;
  onBarClick: (name: string) => void;
}) {
  const en = lang === "en";
  const chartData = data.map(d => ({
    name: d.name.length > 20 ? d.name.slice(0, 18) + "…" : d.name,
    fullName: d.name,
    adet: d.quantity,
    gelir: d.revenue,
  }));
  return (
    <div style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 32, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => formatCurrency(v)} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "var(--color-text)" }} />
          <Tooltip
            formatter={((_value: string | number | undefined, _name: string | number | undefined, item: { payload?: { adet: number; gelir: number } }) => {
              const p = item?.payload;
              return [
                `${formatCurrency(p?.gelir ?? 0)} (${(p?.adet ?? 0).toLocaleString("tr-TR")} ${en ? "units" : "adet"})`,
                en ? "Revenue" : "Gelir",
              ];
            }) as ChartFormatter}
            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
          />
          <Bar
            dataKey="gelir"
            fill={CHART_COLORS[1]}
            radius={[0, 4, 4, 0]}
            style={{ cursor: "pointer" }}
            onClick={(entry: unknown) => {
              const e = entry as { fullName?: string };
              if (e?.fullName) onBarClick(e.fullName);
            }}
          >
            {chartData.map((_entry, i) => (
              <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GroupRevenueQuantityChart({ data, lang, onBarClick }: {
  data: Array<{ group: string; revenue: number; quantity: number }>;
  lang: string;
  onBarClick: (group: string) => void;
}) {
  const en = lang === "en";
  const chartData = data.map(d => ({
    name: d.group.length > 16 ? d.group.slice(0, 14) + "…" : d.group,
    fullName: d.group,
    ciro: d.revenue,
    adet: d.quantity,
  }));
  return (
    <div style={{ height: 340 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => formatCurrency(v)} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => v.toLocaleString("tr-TR")} />
          <Tooltip
            formatter={((value: string | number | undefined, name: string | number | undefined) => {
              if (name === "adet") return [Number(value ?? 0).toLocaleString("tr-TR"), en ? "Quantity" : "Adet"];
              return [formatCurrency(Number(value ?? 0)), en ? "Revenue" : "Gelir"];
            }) as ChartFormatter}
            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
          />
          <Legend formatter={(value: string) => value === "adet" ? (en ? "Quantity" : "Adet") : (en ? "Revenue" : "Gelir")} />
          <Bar yAxisId="left" dataKey="ciro" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} style={{ cursor: "pointer" }}
            onClick={(entry: unknown) => { const e = entry as { fullName?: string }; if (e?.fullName) onBarClick(e.fullName); }}
          />
          <Bar yAxisId="right" dataKey="adet" fill={CHART_COLORS[5]} radius={[4, 4, 0, 0]} style={{ cursor: "pointer" }}
            onClick={(entry: unknown) => { const e = entry as { fullName?: string }; if (e?.fullName) onBarClick(e.fullName); }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HourlyDensityChart({ data, lang }: {
  data: Array<{ hour: number; revenue: number; count: number }>;
  lang: string;
}) {
  const en = lang === "en";
  const chartData = data.map(d => ({ label: `${String(d.hour).padStart(2, "0")}:00`, revenue: d.revenue, count: d.count }));
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => formatCurrency(v)} />
          <Tooltip
            formatter={((_value: string | number | undefined, _name: string | number | undefined, item: { payload?: { revenue: number; count: number } }) => {
              const p = item?.payload;
              return [`${formatCurrency(p?.revenue ?? 0)} (${(p?.count ?? 0).toLocaleString("tr-TR")} ${en ? "sales" : "satış"})`, en ? "Revenue" : "Gelir"];
            }) as ChartFormatter}
            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
          />
          <Bar dataKey="revenue" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function FastMovingStockTable({ data, lang }: {
  data: Array<{ productName: string; stockAtSale: number; soldQuantity: number }>;
  lang: string;
}) {
  const en = lang === "en";
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="table" style={{ width: "100%", fontSize: "13px" }}>
        <thead>
          <tr>
            <th>{en ? "Product" : "Ürün"}</th>
            <th>{en ? "Last Known Stock" : "Son Bilinen Stok"}</th>
            <th>{en ? "Sold in Period" : "Dönemde Satılan"}</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.productName}>
              <td style={{ fontWeight: 600 }}>{row.productName}</td>
              <td style={{ fontWeight: 700, color: row.stockAtSale <= 0 ? "var(--color-danger)" : "var(--color-warning)" }}>{row.stockAtSale.toLocaleString("tr-TR")}</td>
              <td>{row.soldQuantity.toLocaleString("tr-TR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaffPerformanceTable({ data, lang }: {
  data: Array<{ staffName: string; totalRevenue: number; saleCount: number; prescriptionPct: number }>;
  lang: string;
}) {
  const en = lang === "en";
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="table" style={{ width: "100%", fontSize: "13px" }}>
        <thead>
          <tr>
            <th>{en ? "Staff" : "Personel"}</th>
            <th>{en ? "Total Revenue" : "Toplam Ciro"}</th>
            <th>{en ? "Sale Count" : "Satış Sayısı"}</th>
            <th>{en ? "Prescription %" : "Reçeteli %"}</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.staffName}>
              <td style={{ fontWeight: 600 }}>{row.staffName}</td>
              <td style={{ fontWeight: 700 }}>{formatCurrency(row.totalRevenue)}</td>
              <td>{row.saleCount.toLocaleString("tr-TR")}</td>
              <td>%{row.prescriptionPct.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayOfWeekChart({ data, lang }: {
  data: Array<{ label: string; avgRevenue: number }>;
  lang: string;
}) {
  const en = lang === "en";
  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => formatCurrency(v)} />
          <Tooltip
            formatter={((value: string | number | undefined) => [formatCurrency(Number(value ?? 0)), en ? "Avg. Revenue" : "Ort. Ciro"]) as ChartFormatter}
            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
          />
          <Bar dataKey="avgRevenue" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendChart({ data, lang }: {
  data: Array<{ label: string; avgTicket: number; avgDiscountRate: number }>;
  lang: string;
}) {
  const en = lang === "en";
  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => formatCurrency(v)} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => `%${v.toFixed(0)}`} />
          <Tooltip
            formatter={((value: string | number | undefined, name: string | number | undefined) => {
              if (name === "avgDiscountRate") return [`%${Number(value ?? 0).toFixed(1)}`, en ? "Avg. Discount Rate" : "Ort. İskonto Oranı"];
              return [formatCurrency(Number(value ?? 0)), en ? "Avg. Ticket" : "Ort. Fiş Tutarı"];
            }) as ChartFormatter}
            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
          />
          <Legend formatter={(value: string) => value === "avgDiscountRate" ? (en ? "Avg. Discount Rate" : "Ort. İskonto Oranı") : (en ? "Avg. Ticket" : "Ort. Fiş Tutarı")} />
          <Line yAxisId="left" type="monotone" dataKey="avgTicket" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
          <Line yAxisId="right" type="monotone" dataKey="avgDiscountRate" stroke={CHART_COLORS[4]} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TransactionTypeChart({ data, lang }: {
  data: Array<{ label: string; revenue: number }>;
  lang: string;
}) {
  const chartData = data.map(d => ({
    name: d.label.length > 22 ? d.label.slice(0, 20) + "…" : d.label,
    fullName: d.label,
    revenue: d.revenue,
  }));
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 32, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => formatCurrency(v)} />
          <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: "var(--color-text)" }} />
          <Tooltip
            formatter={((value: string | number | undefined) => [formatCurrency(Number(value ?? 0)), lang === "en" ? "Revenue" : "Gelir"]) as ChartFormatter}
            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
          />
          <Bar dataKey="revenue" fill={CHART_COLORS[5]} radius={[0, 4, 4, 0]}>
            {chartData.map((_entry, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RechVsRetailComparisonChart({ prescriptionRevenue, retailRevenue, prescriptionCount, retailCount, lang }: {
  prescriptionRevenue: number;
  retailRevenue: number;
  prescriptionCount: number;
  retailCount: number;
  lang: string;
}) {
  const en = lang === "en";
  const revenueData = [
    { name: en ? "Prescription" : "Reçeteli", value: prescriptionRevenue },
    { name: en ? "Retail" : "Perakende", value: retailRevenue },
  ];
  const countData = [
    { name: en ? "Prescription" : "Reçeteli", value: prescriptionCount },
    { name: en ? "Retail" : "Perakende", value: retailCount },
  ];
  return (
    <div className="responsive-grid responsive-grid-1-1" style={{ gap: "var(--spacing-4)" }}>
      <div>
        <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "6px", textAlign: "center" }}>
          {en ? "Total Revenue" : "Toplam Ciro"}
        </p>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip
                formatter={((value: string | number | undefined) => [formatCurrency(Number(value ?? 0)), en ? "Revenue" : "Ciro"]) as ChartFormatter}
                contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {revenueData.map((_e, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "6px", textAlign: "center" }}>
          {en ? "Transaction Count" : "İşlem Sayısı"}
        </p>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={countData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
              <Tooltip
                formatter={((value: string | number | undefined) => [Number(value ?? 0).toLocaleString("tr-TR"), en ? "Transactions" : "İşlem"]) as ChartFormatter}
                contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {countData.map((_e, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// Seçilen sütunun dosyadaki ilk birkaç gerçek değerini döndürür — kullanıcı
// "bu sütun gerçekten doğru mu" sorusunu kör tahminle değil, örnek veriye
// bakarak yanıtlayabilir (envanter modülündeki aynı UX iyileştirmesi).
function sampleValuesFor(headers: string[], dataRows: unknown[][], headerName: string): string[] {
  const idx = headers.indexOf(headerName);
  if (idx < 0) return [];
  return dataRows
    .slice(0, 3)
    .map(row => String(row[idx] ?? "").trim())
    .filter(v => v !== "");
}

// Modül kapsamında tanımlandı — render içinde tanımlanırsa her render'da yeni
// bir bileşen türü sayılır ve seçim kutusu odağını/durumunu kaybedebilir.
function ColSelect({ fieldKey, label, hint, headers, dataRows, selected, lang, onChange }: {
  fieldKey: keyof ColumnOverride;
  label: string;
  hint?: string;
  headers: string[];
  dataRows: unknown[][];
  selected: string;
  lang: string;
  onChange: (fieldKey: keyof ColumnOverride, value: string) => void;
}) {
  const samples = selected ? sampleValuesFor(headers, dataRows, selected) : [];
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">{label}</label>
      <select className="form-input" value={selected}
        onChange={e => onChange(fieldKey, e.target.value)}>
        <option value="">{lang === "en" ? "— Not Selected —" : "— Seçilmedi —"}</option>
        {headers.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      {hint && <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>{hint}</p>}
      <div style={{ marginTop: "4px", fontSize: "11px", minHeight: "16px" }}>
        {selected && (
          samples.length > 0 ? (
            <span style={{ color: "var(--color-text-muted)" }}>
              {lang === "en" ? "Sample: " : "Örnek: "}
              <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{samples.join(" · ")}</span>
            </span>
          ) : (
            <span style={{ color: "var(--color-text-muted)" }}>{lang === "en" ? "This column appears empty in the first rows." : "Bu sütun ilk satırlarda boş görünüyor."}</span>
          )
        )}
      </div>
    </div>
  );
}

export default function SatisRaporPage() {
  const { lang } = useLangContext();
  const [tab, setTab] = useState<"upload" | "list" | "history">("list");

  // İçe Aktarma Geçmişi (Part B)
  interface ImportBatch {
    importBatchId: string | null;
    importDate: string | null;
    recordCount: number;
    dateRangeStart: string | null;
    dateRangeEnd: string | null;
    totalRevenue: number;
  }
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<ImportBatch | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const fetchBatches = async () => {
    setBatchesLoading(true);
    try {
      const res = await fetch("/api/v1/satis/batches", { headers: { "Accept-Language": lang } });
      const json = await res.json() as { success: boolean; data?: { batches: ImportBatch[] } };
      if (json.success && json.data) setBatches(json.data.batches);
    } catch { /* silent */ } finally { setBatchesLoading(false); }
  };

  // Async veri çekimi — setState await sonrası çalışır, senkron değildir.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (tab === "history") void fetchBatches(); }, [tab]);

  // "Son Yükleme" özet kartı liste/yükleme sekmelerinde de görünür olduğundan
  // (kullanıcı ayrıca "İçe Aktarma Geçmişi" sekmesine girmeden en son yüklemeyi
  // görebilsin diye), batches ilk açılışta bir kez de (tab "history" olmasa
  // bile) çekilir.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchBatches(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteBatch = async () => {
    if (!batchDeleteTarget) return;
    setBatchDeleting(true);
    try {
      const idPart = batchDeleteTarget.importBatchId === null ? "_none_" : encodeURIComponent(batchDeleteTarget.importBatchId);
      await fetch(`/api/v1/satis/batches/${idPart}`, { method: "DELETE", headers: { "Accept-Language": lang } });
      setBatchDeleteTarget(null);
      await fetchBatches();
      await fetchRecords();
    } catch { /* silent */ } finally { setBatchDeleting(false); }
  };

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<UploadStep>("select");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [previewRows, setPreviewRows] = useState<ParsedSaleRow[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<unknown[][]>([]);
  const [override, setOverride] = useState<ColumnOverride>({});
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showInvalidDateDetail, setShowInvalidDateDetail] = useState(false);
  const [lastSaveExcludedCount, setLastSaveExcludedCount] = useState(0);

  // Çakışma (overlap) tespiti — kaydedilecek dosyanın tarih aralığı zaten
  // kayıtlı satışlarla çakışıyorsa (bkz. handleConfirm), kullanıcı üç seçenekten
  // birini seçene kadar kayıt BEKLETİLİR. `checkingOverlap`, "Onayla ve Kaydet"
  // butonuna basıldıktan sonra kontrol sorgusu sürerken (henüz modal açılmadan
  // önceki kısa an) gösterilen ayrı bir "kontrol ediliyor" durumudur.
  const [checkingOverlap, setCheckingOverlap] = useState(false);
  const [overlapCheck, setOverlapCheck] = useState<{
    span: { start: string; end: string };
    rowsToSave: ParsedSaleRow[];
    excludedCount: number;
    count: number;
    batchCount: number;
  } | null>(null);
  const [overlapBusy, setOverlapBusy] = useState<"delete" | null>(null);

  // List state
  const now = new Date();
  const [startDate, setStartDate] = useState(toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [endDate, setEndDate] = useState(toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [filterType, setFilterType] = useState<"" | "PRESCRIPTION" | "RETAIL">("");
  // Tarih/tip seçimi ile gerçek veri çekimi ayrıştırılmıştır: kullanıcı
  // takvimden tarih seçtiğinde HENÜZ fetch tetiklenmez — yalnızca "bekleyen"
  // (pending) değerler güncellenir. Gerçek fetch, "Filtrele" butonuna
  // tıklandığında pending değerler uygulanan (applied) filtrelere kopyalanarak
  // yapılır. İlk yüklemede otomatik fetch korunur (aşağıdaki mount-only effect).
  const [pendingStartDate, setPendingStartDate] = useState(startDate);
  const [pendingEndDate, setPendingEndDate] = useState(endDate);
  const [pendingFilterType, setPendingFilterType] = useState<"" | "PRESCRIPTION" | "RETAIL">(filterType);
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [summary, setSummary] = useState<SaleSummary | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [drillDown, setDrillDown] = useState<{ title: string; records: SaleRecord[] } | null>(null);

  const dailyRevenueData = useMemo(() => {
    const byDay = new Map<string, { revenue: number; prescriptionRevenue: number; retailRevenue: number }>();
    for (const r of records) {
      const day = r.saleDate.split("T")[0];
      const cur = byDay.get(day) ?? { revenue: 0, prescriptionRevenue: 0, retailRevenue: 0 };
      cur.revenue += r.netRevenue;
      if (r.saleType === "PRESCRIPTION") cur.prescriptionRevenue += r.netRevenue;
      else cur.retailRevenue += r.netRevenue;
      byDay.set(day, cur);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        label: format(parseDateOnlyLocal(date), "dd MMM", { locale: lang === "en" ? enUS : tr }),
        ...v,
      }));
  }, [records, lang]);

  // #2 İşlem/Ödeme Tiplerine Göre Satış Dağılımı — ham "İşlem Tipi" metnine göre
  // gruplanır (K.K./Nakit/Reçete ayrımını koruyarak). rawTransactionType hiçbir
  // kayıtta yoksa (eski dosyalar) boş dizi döner — sayfa bunu boş-durum olarak gösterir.
  const transactionTypeData = useMemo(() => {
    const withType = records.filter(r => r.rawTransactionType?.trim());
    if (withType.length === 0) return [];
    const byType = new Map<string, number>();
    for (const r of withType) {
      const key = r.rawTransactionType!.trim();
      byType.set(key, (byType.get(key) ?? 0) + r.netRevenue);
    }
    const items = Array.from(byType.entries()).map(([label, revenue]) => ({ label, revenue }));
    const { top, otherSum } = topNWithOther(items, "label", "revenue", 8);
    const result = top.map(t => ({ label: t.label, revenue: t.revenue }));
    if (otherSum > 0) result.push({ label: lang === "en" ? "Other" : "Diğer", revenue: otherSum });
    return result;
  }, [records, lang]);

  // #4 Ortalama Sepet Tutarı (AOV) — tüm dönem geneli tek bir stat.
  const overallAov = useMemo(() => {
    if (records.length === 0) return 0;
    return records.reduce((s, r) => s + r.netRevenue, 0) / records.length;
  }, [records]);

  // #6 Haftanın Günlerine Göre Perakende Satış Yoğunluğu — SADECE perakende.
  const dayOfWeekRetailData = useMemo(() => aggregateByDayOfWeek(records, lang === "en" ? "en" : "tr", "RETAIL"), [records, lang]);

  // Kategori Bazında Ciro/Adet Dağılımı — "Ürün Grup" sütunu gerçek çeşitlilik
  // taşıyorsa (tek "Genel" kovasına düşmüyorsa) hem ciro hem adet gösterilir.
  const groupRevenueQuantityData = useMemo(() => {
    const byGroup = new Map<string, { revenue: number; quantity: number }>();
    for (const r of records) {
      const g = r.productGroup || "Genel";
      const cur = byGroup.get(g) ?? { revenue: 0, quantity: 0 };
      cur.revenue += r.netRevenue;
      cur.quantity += r.quantity;
      byGroup.set(g, cur);
    }
    const sorted = Array.from(byGroup.entries()).sort(([, a], [, b]) => b.revenue - a.revenue);
    const top = sorted.slice(0, 10).map(([group, v]) => ({ group, ...v }));
    const rest = sorted.slice(10);
    if (rest.length > 0) {
      const other = rest.reduce((acc, [, v]) => ({ revenue: acc.revenue + v.revenue, quantity: acc.quantity + v.quantity }), { revenue: 0, quantity: 0 });
      top.push({ group: lang === "en" ? "Other" : "Diğer", ...other });
    }
    return top;
  }, [records, lang]);
  const hasRealGroupData = useMemo(() => new Set(records.map(r => r.productGroup || "Genel")).size > 1, [records]);

  // Saat Bazlı Yoğunluk Analizi — SADECE `saleHour` alanı ayrıştırılabilen satırlar
  // (dosyada "Saat" sütunu yoksa veya değer ayrıştırılamadıysa dahil edilmez).
  const hourlyDensityData = useMemo(() => {
    const byHour = new Map<number, { revenue: number; count: number }>();
    for (const r of records) {
      if (r.saleHour === undefined || r.saleHour === null) continue;
      const cur = byHour.get(r.saleHour) ?? { revenue: 0, count: 0 };
      cur.revenue += r.netRevenue;
      cur.count += 1;
      byHour.set(r.saleHour, cur);
    }
    return Array.from(byHour.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, v]) => ({ hour, ...v }));
  }, [records]);

  // Hızlı Tükenen Ürünler Sinyali — dosyadaki "Stok Adet" satır anlık görüntülerinden
  // ürün başına EN SON bilinen stok + dönem içi satılan toplam adet. CANLI stok
  // takibi DEĞİLDİR, yalnızca satış dosyasına dayalı bir sinyaldir.
  const fastMovingStockData = useMemo(() => {
    const byProduct = new Map<string, { lastStock: number; lastDate: string; soldQuantity: number }>();
    for (const r of records) {
      if (r.stockAtSale === undefined || r.stockAtSale === null) continue;
      const cur = byProduct.get(r.productName) ?? { lastStock: r.stockAtSale, lastDate: r.saleDate, soldQuantity: 0 };
      cur.soldQuantity += r.quantity;
      if (r.saleDate >= cur.lastDate) { cur.lastStock = r.stockAtSale; cur.lastDate = r.saleDate; }
      byProduct.set(r.productName, cur);
    }
    return Array.from(byProduct.entries())
      .map(([productName, v]) => ({ productName, stockAtSale: v.lastStock, soldQuantity: v.soldQuantity }))
      .sort((a, b) => a.stockAtSale - b.stockAtSale)
      .slice(0, 15);
  }, [records]);
  const hasStockData = useMemo(() => records.some(r => r.stockAtSale !== undefined && r.stockAtSale !== null), [records]);

  const topProductsData = useMemo(() => {
    const byProduct = new Map<string, { quantity: number; revenue: number }>();
    for (const r of records) {
      const cur = byProduct.get(r.productName) ?? { quantity: 0, revenue: 0 };
      cur.quantity += r.quantity;
      cur.revenue += r.netRevenue;
      byProduct.set(r.productName, cur);
    }
    return Array.from(byProduct.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [records]);

  // Personel bazlı performans — dosyada personel sütunu varsa hesaplanır.
  const staffPerformanceData = useMemo(() => aggregateByStaff(records), [records]);
  const hasStaffColumn = useMemo(() => hasStaffData(records), [records]);

  // Haftanın günü bazında yoğunluk (saat bilgisi verilerde saklanmadığı için
  // gerçek saatlik yoğunluk yerine dürüst bir vekil metrik olarak kullanılıyor).
  const dayOfWeekData = useMemo(() => aggregateByDayOfWeek(records, lang === "en" ? "en" : "tr"), [records, lang]);

  // Ortalama fiş tutarı ve iskonto oranı trendi (haftalık/aylık, veri aralığına göre).
  const periodTrendData = useMemo(() => aggregatePeriodTrend(records), [records]);

  // SGK Fatura karşılaştırması — SADECE bilgilendirme amaçlı, salt okunur.
  // Kasa/Panel/SGK Fatura toplamlarına HİÇBİR ŞEKİLDE yazılmaz veya beslenmez.
  const [sgkInvoicedThisMonth, setSgkInvoicedThisMonth] = useState<number | null>(null);
  const [sgkLoading, setSgkLoading] = useState(false);

  const fetchSgkComparison = async () => {
    setSgkLoading(true);
    try {
      const res = await fetch("/api/v1/finans/sgk-fatura", { headers: { "Accept-Language": lang } });
      const json = await res.json() as { success: boolean; data?: Array<{ invoiceDate: string; amount: string | number }> };
      if (json.success && json.data) {
        // Seçili dönemin (startDate..endDate) ayına denk düşen faturaları topla —
        // sayfadaki filtre tarih aralığı aynı ayı kapsıyorsa o aya göre, değilse
        // aralığın başlangıç ayına göre karşılaştırma yapılır.
        const monthKey = startDate.slice(0, 7);
        const total = json.data
          .filter(inv => String(inv.invoiceDate).slice(0, 7) === monthKey)
          .reduce((s, inv) => s + Number(inv.amount), 0);
        setSgkInvoicedThisMonth(total);
      }
    } catch { /* silent — bilgilendirme amaçlı, hata sessizce yutulur */ }
    finally { setSgkLoading(false); }
  };

  // Async veri çekimi — setState await sonrası çalışır, senkron değildir.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchSgkComparison(); }, [lang, startDate]);

  const prescriptionRevenueThisPeriod = summary?.prescriptionRevenue ?? 0;
  const sgkDiffPct = sgkInvoicedThisMonth && sgkInvoicedThisMonth > 0
    ? Math.abs(prescriptionRevenueThisPeriod - sgkInvoicedThisMonth) / sgkInvoicedThisMonth * 100
    : null;
  const sgkDiffIsWarning = sgkDiffPct !== null && sgkDiffPct > 10;

  const fetchRecordsWith = async (start: string, end: string, type: "" | "PRESCRIPTION" | "RETAIL") => {
    setListLoading(true);
    try {
      const p = new URLSearchParams({ start, end });
      if (type) p.set("type", type);
      const res = await fetch(`/api/v1/satis?${p}`, { headers: { "Accept-Language": lang } });
      let json: { success: boolean; data?: { records: SaleRecord[]; summary: SaleSummary } };
      try {
        json = await res.json() as { success: boolean; data?: { records: SaleRecord[]; summary: SaleSummary } };
      } catch {
        // Sunucu/platform katmanı JSON olmayan bir hata döndürdü — sessizce geç
        return;
      }
      if (json.success && json.data) { setRecords(json.data.records); setSummary(json.data.summary); }
    } catch { /* silent */ } finally { setListLoading(false); }
  };

  // Uygulanmış (applied) filtrelerle fetch — kaydetme/silme gibi programatik
  // yenilemeler için kullanılır (bkz. çağıran yerler).
  const fetchRecords = async () => { await fetchRecordsWith(startDate, endDate, filterType); };

  // Yalnızca ilk yüklemede otomatik fetch yapılır — sonrasında tarih/tip
  // seçimi "Filtrele" butonuna basılana kadar fetch tetiklemez (bkz.
  // handleApplyFilters).
  //
  // Varsayılan aralık daha önce HER ZAMAN "içinde bulunulan takvim ayı"
  // olarak sabitlenmişti — eczanenin gerçekte yüklediği veri (ör. Temmuz +
  // Ağustos'un ilk 11 günü) farklı bir ayda/aralıkta olsa bile. Sayfa
  // açıldığında önce bu eczaneye ait TÜM kayıtların gerçek min/max
  // `saleDate` aralığı hafif bir agregat sorgusuyla (`/api/v1/satis/date-range`)
  // çekilir.
  //
  // Bu aralık DOĞRUDAN varsayılan olarak kullanılmaz — birden fazla ayı
  // (ör. Temmuz + Ağustos'un ilk 11 günü) kapsıyorsa kullanıcı için yanıltıcı
  // olur (gerçek bir kullanıcı geri bildirimiyle tespit edildi: "ay ay
  // olması lazım"). Bunun yerine yalnızca EN SON verinin bulunduğu takvim
  // ayı (o ayın 1'i ile ayın içindeki en son veri tarihi arasında, ayın
  // henüz bitmemiş kısmına kadar) varsayılan olarak seçilir. Hiç kayıt yoksa
  // (`count === 0`, gerçekten yeni kullanıcı) sabit "bu ay" varsayılanı
  // olduğu gibi korunur. Kaydetme/preset sonrası otomatik genişletme mantığı
  // (`saleRowsDateSpan` — bkz. handleConfirm) burada DEĞİŞTİRİLMEDİ, yalnızca
  // İLK açılıştaki varsayılan aynı desenle (pending + uygulanmış state'i
  // birlikte güncelleyip ardından fetch tetikleyerek) belirleniyor.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/satis/date-range", { headers: { "Accept-Language": lang } });
        const json = await res.json() as { success: boolean; data?: { minDate: string | null; maxDate: string | null; count: number } };
        if (json.success && json.data && json.data.count > 0 && json.data.minDate && json.data.maxDate) {
          const actualMinStr = json.data.minDate.slice(0, 10);
          const actualMaxStr = json.data.maxDate.slice(0, 10);
          const [maxY, maxM] = actualMaxStr.split("-").map(Number);
          const monthStartStr = toDateStr(new Date(maxY, maxM - 1, 1));
          // En son veri ayının başlangıcı, verinin gerçek min tarihinden
          // önceyse (ör. veri zaten o ay içinde başlıyorsa) min tarih kullanılır.
          const actualStart = monthStartStr > actualMinStr ? monthStartStr : actualMinStr;
          const actualEnd = actualMaxStr;
          setStartDate(actualStart);
          setEndDate(actualEnd);
          setPendingStartDate(actualStart);
          setPendingEndDate(actualEnd);
          await fetchRecordsWith(actualStart, actualEnd, filterType);
          return;
        }
      } catch { /* silent — sabit "bu ay" varsayılanıyla devam edilir */ }
      await fetchRecordsWith(startDate, endDate, filterType);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApplyFilters = () => {
    setStartDate(pendingStartDate);
    setEndDate(pendingEndDate);
    setFilterType(pendingFilterType);
    void fetchRecordsWith(pendingStartDate, pendingEndDate, pendingFilterType);
  };

  // Hazır aralık ("preset") butonları: manuel tarih seçiminin aksine, bir
  // preset'e tıklamak pending değerleri günceller VE aynı anda uygulamayı
  // (fetch) tetikler — kullanıcı ayrıca "Filtrele"ye basmak zorunda kalmaz.
  const handlePresetClick = (start: string, end: string) => {
    setPendingStartDate(start);
    setPendingEndDate(end);
    setStartDate(start);
    setEndDate(end);
    void fetchRecordsWith(start, end, pendingFilterType);
  };

  // Uygulanmış (applied) aralığın hangi preset'e karşılık geldiği — eşleşen
  // preset varsa o buton "aktif" görünür; manuel/özel bir aralıksa hiçbiri
  // vurgulanmaz.
  const activePresetKey = useMemo(() => matchPreset(startDate, endDate), [startDate, endDate]);
  const pendingDiffersFromApplied = pendingStartDate !== startDate || pendingEndDate !== endDate;

  const resetUpload = () => {
    setFile(null); setStep("select"); setParseError("");
    setPreviewRows([]); setColumnMap(null); setHeaders([]); setDataRows([]);
    setOverride({}); setSaveSuccess(false);
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setParseError(""); setStep("select"); }
  };

  // Dosya sadece BİR KEZ yüklenir (bu fonksiyon aracılığıyla). Kolon eşleştirmesi
  // değiştirildiğinde dosya tekrar sunucuya gönderilmez — `dataRows` önbelleğe
  // alınır ve `mapRow` istemci tarafında (senkron) tekrar çalıştırılır.
  const callParse = async (): Promise<{ map: ColumnMap | null; rows: ParsedSaleRow[] } | null> => {
    if (!file) return null;
    setParsing(true); setParseError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/satis/parse", { method: "POST", headers: { "Accept-Language": lang }, body: fd });
      let json: {
        success: boolean;
        data?: { rows: ParsedSaleRow[]; columnMap: ColumnMap | null; headers: string[]; dataRows: unknown[][] };
        error?: string;
      };
      try {
        json = await res.json() as {
          success: boolean;
          data?: { rows: ParsedSaleRow[]; columnMap: ColumnMap | null; headers: string[]; dataRows: unknown[][] };
          error?: string;
        };
      } catch {
        // Sunucu/platform katmanı JSON olmayan bir hata döndürdü (ör. "Request Entity Too Large")
        throw new Error(lang === "en" ? "Server returned an invalid response. The file may be too large." : "Sunucudan geçersiz bir yanıt alındı. Dosya çok büyük olabilir.");
      }
      if (!res.ok || !json.success) throw new Error(json.error ?? (lang === "en" ? "File could not be read" : "Dosya okunamadı"));
      setPreviewRows(json.data!.rows);
      setColumnMap(json.data!.columnMap ?? null);
      setHeaders(json.data!.headers ?? []);
      setDataRows(json.data!.dataRows ?? []);
      return { map: json.data!.columnMap ?? null, rows: json.data!.rows };
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
      return null;
    } finally { setParsing(false); }
  };

  // CSV/Excel dosyaları tamamen tarayıcıda ayrıştırılır — sunucuya hiçbir dosya
  // yüklenmez, bu yüzden platformun istek boyutu sınırına takılma riski olmaz.
  // Yalnızca PDF (konum tabanlı, pdfjs gerektirir) sunucu üzerinden işlenir.
  const handleReadFileClient = async (): Promise<{ map: ColumnMap | null; rows: ParsedSaleRow[] } | null> => {
    if (!file) return null;
    setParsing(true); setParseError("");
    try {
      const { headers: parsedHeaders, dataRows: rawDataRows } = await parseSalesFileClient(file);
      const nonEmptyRows = rawDataRows.filter(row => !row.every(c => !c));
      if (!nonEmptyRows.length) throw new Error(lang === "en" ? "No sales data found in file" : "Dosyadan satış verisi okunamadı");

      let map: ColumnMap | null = null;
      const rows: ParsedSaleRow[] = nonEmptyRows.map(row => {
        const mapped = mapRow(parsedHeaders, row, {});
        if (!map) map = mapped.colMap;
        return mapped.row;
      });

      setPreviewRows(rows);
      setColumnMap(map);
      setHeaders(parsedHeaders);
      setDataRows(nonEmptyRows);
      return { map, rows };
    } catch (err) {
      setParseError(err instanceof Error ? err.message : (lang === "en" ? "File could not be read" : "Dosya okunamadı"));
      return null;
    } finally { setParsing(false); }
  };

  // Ad, tarih, fiyat ve adet (veya net tutar) sütunları otomatik ve güvenilir
  // şekilde bulunduysa kullanıcıdan manuel kolon eşleştirmesi istenmez —
  // doğrudan önizlemeye geçilir. "← Kolonları Düzenle" ile her zaman geri
  // dönülüp düzeltilebilir.
  //
  // Ek güvenlik kontrolü: tarih sütunu "bulunmuş" görünse bile, o sütundaki
  // değerler gerçekten ayrıştırılamıyorsa (ör. beklenmeyen bir tarih biçimi),
  // parseDate sessizce BUGÜNÜN tarihine düşer — bu da tüm satırların aynı
  // güne yığılmasına yol açan gerçek bir üretim hatasıydı. Bu yüzden birden
  // fazla satır varsa, üretilen tarihlerin en az ikisinin FARKLI olması
  // isteniyor; aksi halde (tek bir tarihe yığılma şüphesi) manuel kontrol
  // ekranı gösterilir.
  const looksLikeDateFallback = (rows: ParsedSaleRow[]): boolean => {
    if (rows.length < 5) return false;
    const distinctDates = new Set(rows.slice(0, 200).map(r => r.saleDate.split("T")[0]));
    return distinctDates.size === 1;
  };

  // Dosya ayrıştırıldığı anda (kaydetmeden ÖNCE, önizleme aşamasında) tarih
  // aralığı filtresi dosyanın gerçek min/max `saleDate` aralığına göre
  // ayarlanır — kullanıcı önizlemede gördüğü tutarların, kaydettikten sonra
  // gösterilen (varsayılan "bu ay" gibi eski bir aralıkla sorgulanan) tutarla
  // tutarsız görünmesi sorununu önler. `saleRowsDateSpan`, kayıt SONRASI
  // aynı amaçla `handleConfirm` içinde de kullanılan tek, paylaşılan (DRY)
  // saf fonksiyondur — burada `fetchRecords()` TETİKLENMEZ, yalnızca
  // gösterilen filtre state'i (pending + uygulanmış) güncellenir; asıl veri
  // çekme kayıt sonrası veya kullanıcının Filtrele/preset etkileşimiyle olur.
  const applyDateSpanFromRows = (rows: ParsedSaleRow[]) => {
    const span = saleRowsDateSpan(rows.filter(r => !r.dateInvalid));
    if (!span) return;
    setPendingStartDate(span.start);
    setPendingEndDate(span.end);
    setStartDate(span.start);
    setEndDate(span.end);
  };

  const handleReadFile = async () => {
    const result = file && isClientParseable(file.name)
      ? await handleReadFileClient()
      : await callParse();
    const confident = !!result?.map && isColumnMapConfident(result.map) && !looksLikeDateFallback(result.rows);
    setStep(confident ? "preview" : "mapping");
    if (result?.rows.length) applyDateSpanFromRows(result.rows);
  };

  // Ağ isteği YOK — kolon eşleştirmesi, önbellekteki `dataRows` üzerinde
  // paylaşılan `mapRow` fonksiyonu ile istemci tarafında yeniden hesaplanır.
  const handleApplyMapping = () => {
    if (columnMap) {
      const rows = dataRows.map(row => mapRow(headers, row, override).row);
      setPreviewRows(rows);
      applyDateSpanFromRows(rows);
    }
    setStep("preview");
  };

  // Tüm satırları TEK bir JSON isteğinde göndermek, büyük dosyalarda (binlerce
  // satır) platformun istek boyutu sınırına takılıp "geçersiz yanıt" hatasına
  // yol açıyordu. Satırlar artık makul boyutlu gruplar (chunk) halinde, aynı
  // importBatchId ile ardışık olarak gönderiliyor.
  const SAVE_CHUNK_SIZE = 1000;

  // Tarihi ayrıştırılamayan (dateInvalid) satırlar KAYDEDİLMEZ — mapRow.ts'de
  // `isParseableDate` false döndüğünde parseDate sessizce BUGÜNE düşer; bu tek
  // satırlık sessiz veri bozulması, dosyanın geri kalanı tamamen doğru
  // ayrıştırılsa bile "bugünün ayında" hayalet bir kayıt olarak görünürdü
  // (gerçek, tekrarlayan bir üretim hatasının kök nedeni). Bu yüzden bu
  // satırlar önizlemede ayrıca gösterilir ama KAYDETME'ye dahil edilmez.
  const invalidDateRows = previewRows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.dateInvalid);
  const validPreviewRows = previewRows.filter(r => !r.dateInvalid);

  // Asıl kayıt işlemi — önceden `handleConfirm`'in tamamıydı; şimdi ayrı bir
  // fonksiyona çıkarıldı çünkü artık İKİ farklı noktadan tetiklenebiliyor:
  // (1) çakışma YOKSA handleConfirm doğrudan çağırır, (2) çakışma VARSA
  // kullanıcı overlap modal'ında "sil ve kaydet" ya da "yine de ekle"yi
  // seçtikten SONRA çağrılır (bkz. handleOverlapDeleteAndSave / handleOverlapAddAnyway).
  const performSave = async (rowsToSave: ParsedSaleRow[], excludedCount: number) => {
    setSaving(true); setParseError(""); setSaveProgress(null);
    try {
      const batchId = `batch_${Date.now()}`;
      const chunks: ParsedSaleRow[][] = [];
      for (let i = 0; i < rowsToSave.length; i += SAVE_CHUNK_SIZE) {
        chunks.push(rowsToSave.slice(i, i + SAVE_CHUNK_SIZE));
      }

      let savedCount = 0;
      for (let i = 0; i < chunks.length; i++) {
        setSaveProgress({ done: i, total: chunks.length });
        const res = await fetch("/api/v1/satis", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept-Language": lang },
          body: JSON.stringify({ rows: chunks[i], importBatchId: batchId }),
        });
        let json: { success: boolean; count?: number; error?: string };
        try {
          json = await res.json() as { success: boolean; count?: number; error?: string };
        } catch {
          throw new Error(lang === "en"
            ? `Server returned an invalid response while saving rows ${i * SAVE_CHUNK_SIZE + 1}-${i * SAVE_CHUNK_SIZE + chunks[i].length}. ${savedCount} rows were already saved before this point.`
            : `${i * SAVE_CHUNK_SIZE + 1}-${i * SAVE_CHUNK_SIZE + chunks[i].length} satırları kaydedilirken sunucudan geçersiz bir yanıt alındı. Bu noktaya kadar ${savedCount} satır zaten kaydedildi.`);
        }
        if (!res.ok || !json.success) {
          throw new Error((json.error ?? (lang === "en" ? "Save failed" : "Kayıt başarısız"))
            + (savedCount > 0 ? (lang === "en" ? ` (${savedCount} rows were already saved before this point.)` : ` (Bu noktaya kadar ${savedCount} satır zaten kaydedildi.)`) : ""));
        }
        savedCount += json.count ?? chunks[i].length;
      }

      setSaveProgress(null);

      // Kaydedilen satırların tarih aralığı, sayfanın o an gösterdiği filtre
      // aralığının (varsayılan: içinde bulunulan ay) DIŞINDA kalabilir — bu
      // durumda kullanıcı "önizlemede X TL gördüm, kayıttan sonra 0 / farklı
      // bir tutar görüyorum" hissine kapılıyordu; oysa iki farklı tarih
      // aralığı sorgulanıyordu. Kayıt tarih aralığını kapsayacak şekilde
      // filtreyi otomatik genişletiyoruz ki kaydedilen veri hemen görünsün.
      const savedSpan = saleRowsDateSpan(rowsToSave);
      if (savedSpan) {
        if (savedSpan.start < startDate) { setStartDate(savedSpan.start); setPendingStartDate(savedSpan.start); }
        if (savedSpan.end > endDate) { setEndDate(savedSpan.end); setPendingEndDate(savedSpan.end); }
      }

      setLastSaveExcludedCount(excludedCount);
      resetUpload();
      setSaveSuccess(true);
      await fetchRecords();
      await fetchBatches();
      setTab("list");
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : (lang === "en" ? "Save failed" : "Kayıt başarısız"));
    } finally { setSaving(false); setSaveProgress(null); }
  };

  // "Onayla ve Kaydet"e basıldığında çalışır. Asıl kaydetmeden ÖNCE, dosyanın
  // gerçek tarih aralığı (`saleRowsDateSpan`) zaten kayıtlı satışlarla
  // çakışıyor mu diye hafif bir kontrol sorgusu (`/api/v1/satis/overlap-check`)
  // yapılır — çakışma varsa kayıt HEMEN yapılmaz, kullanıcıya üç seçenekli bir
  // onay diyaloğu gösterilir (bkz. overlapCheck state + modal JSX'i). Bu, aynı
  // dönemin iki farklı dosyadan gelen satışlarla ÇİFT SAYILMASINI önlemek
  // içindir (AGENTS.md görev notu #3 — finansal doğruluk riski).
  const handleConfirm = async () => {
    setParseError("");
    const rowsToSave = previewRows.filter(r => !r.dateInvalid);
    const excludedCount = previewRows.length - rowsToSave.length;
    if (rowsToSave.length === 0) {
      setParseError(lang === "en"
        ? `None of the ${excludedCount} rows in this file have a parseable date — nothing was saved. Please check your source file.`
        : `Bu dosyadaki ${excludedCount} satırın hiçbirinde tarih ayrıştırılamadı — hiçbir şey kaydedilmedi. Lütfen kaynak dosyanızı kontrol edin.`);
      return;
    }

    const span = saleRowsDateSpan(rowsToSave);
    if (span) {
      setCheckingOverlap(true);
      try {
        const p = new URLSearchParams({ start: span.start, end: span.end });
        const res = await fetch(`/api/v1/satis/overlap-check?${p}`, { headers: { "Accept-Language": lang } });
        const json = await res.json() as { success: boolean; data?: { count: number; batchCount: number } };
        if (json.success && json.data && json.data.count > 0) {
          setCheckingOverlap(false);
          setOverlapCheck({ span, rowsToSave, excludedCount, count: json.data.count, batchCount: json.data.batchCount });
          return; // kullanıcı modal'da bir seçim yapana kadar kayıt BEKLER
        }
      } catch { /* kontrol sorgusu başarısız olursa sessizce normal kayda devam edilir */ }
      setCheckingOverlap(false);
    }

    await performSave(rowsToSave, excludedCount);
  };

  // Overlap modal — Seçenek 1: "Bu aralıktaki eski kayıtları sil, yeni dosyayı kaydet"
  const handleOverlapDeleteAndSave = async () => {
    if (!overlapCheck) return;
    setOverlapBusy("delete");
    try {
      const p = new URLSearchParams({ start: overlapCheck.span.start, end: overlapCheck.span.end });
      const res = await fetch(`/api/v1/satis/overlap?${p}`, { method: "DELETE", headers: { "Accept-Language": lang } });
      const json = await res.json() as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? (lang === "en" ? "Delete failed" : "Silme başarısız oldu"));
      }
      const { rowsToSave, excludedCount } = overlapCheck;
      setOverlapCheck(null);
      await performSave(rowsToSave, excludedCount);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : (lang === "en" ? "Delete failed" : "Silme başarısız oldu"));
      setOverlapCheck(null);
    } finally {
      setOverlapBusy(null);
    }
  };

  // Overlap modal — Seçenek 2: "Yine de ekle (çift sayılabilir)" — hiçbir şey
  // silinmez, kullanıcı çift sayım riskini bilerek kabul eder.
  const handleOverlapAddAnyway = async () => {
    if (!overlapCheck) return;
    const { rowsToSave, excludedCount } = overlapCheck;
    setOverlapCheck(null);
    await performSave(rowsToSave, excludedCount);
  };

  // Overlap modal — Seçenek 3: "İptal" — hiçbir şey kaydedilmez/silinmez,
  // kullanıcı önizleme ekranında kalır.
  const handleOverlapCancel = () => {
    setOverlapCheck(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/v1/satis/${deleteId}`, { method: "DELETE", headers: { "Accept-Language": lang } });
      setDeleteId(null);
      await fetchRecords();
    } catch { /* silent */ } finally { setDeleting(false); }
  };

  const handleClearAll = async () => {
    if (!confirm(lang === "en" ? "All sales records will be deleted. Are you sure?" : "Tüm satış kayıtları silinecek. Emin misiniz?")) return;
    setClearingAll(true);
    try {
      await fetch("/api/v1/satis/clear-all", { method: "DELETE", headers: { "Accept-Language": lang } });
      await fetchRecords();
    } catch { /* silent */ } finally { setClearingAll(false); }
  };

  const totalNetRevenue = validPreviewRows.reduce((s, r) => s + r.netRevenue, 0);

  const effectiveMap = (key: keyof ColumnOverride): string => {
    const ovr = override[key];
    if (ovr !== undefined && typeof ovr === "string") return ovr;
    if (columnMap) {
      const v = columnMap[key as keyof ColumnMap];
      if (typeof v === "string") return v;
    }
    return "";
  };

  const effectiveIsNet = (): boolean => {
    if (override.priceIsNet !== undefined) return override.priceIsNet;
    return columnMap?.priceIsNet ?? false;
  };

  const setOvr = (key: keyof ColumnOverride, val: string | boolean) =>
    setOverride(prev => ({ ...prev, [key]: val }));

  return (
    <div className="page-content">

      {/* Başlık + Sekmeler */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--spacing-6)", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700 }}>{lang === "en" ? "Sales Reports" : "Satış Raporları"}</h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: "4px" }}>{lang === "en" ? "Analyze pharmacy sales data by date range" : "Eczane satış verilerini tarih aralığına göre analiz edin"}</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {(["list", "upload", "history"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="btn"
              style={{ background: tab === t ? "var(--color-primary)" : "var(--color-surface)", color: tab === t ? "white" : "var(--color-text)", border: "1px solid var(--color-border)", fontWeight: 600, fontSize: "13px" }}>
              {t === "list" ? (lang === "en" ? "📋 Sales List" : "📋 Satış Listesi")
                : t === "upload" ? (lang === "en" ? "📤 Import Data" : "📤 Veri Aktar")
                : (lang === "en" ? "🕒 Import History" : "🕒 İçe Aktarma Geçmişi")}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "var(--spacing-5)" }}>
        <PeriodRevenueWidget
          startDate={startDate}
          endDate={endDate}
          title={lang === "en" ? "Period Revenue" : "Dönemsel Ciro"}
        />
      </div>

      {saveSuccess && (
        <div style={{ marginBottom: "var(--spacing-4)", padding: "12px 16px", background: "#e8f5e9", color: "#2e7d32", borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: "14px" }}>
          {lang === "en" ? "✅ Sales saved successfully. You can view them in the list." : "✅ Satışlar başarıyla kaydedildi. Listede görüntüleyebilirsiniz."}
          {lastSaveExcludedCount > 0 && (
            <div style={{ marginTop: "6px", fontWeight: 600, color: "#b45309" }}>
              {lang === "en"
                ? `⚠ ${lastSaveExcludedCount} row(s) had an unparseable date and were NOT saved (check your source file).`
                : `⚠ ${lastSaveExcludedCount} satırda tarih ayrıştırılamadığı için bu satırlar kaydedilmedi (dosyanızı kontrol edin).`}
            </div>
          )}
        </div>
      )}

      <div style={{
        marginBottom: "var(--spacing-5)", padding: "12px 16px", background: "var(--color-primary-pale)",
        border: "1px solid var(--color-primary-light)", borderRadius: "var(--radius-md)", fontSize: "13px",
        color: "var(--color-text)", display: "flex", gap: "10px", alignItems: "flex-start",
      }}>
        <span style={{ fontSize: "18px", flexShrink: 0 }}>ℹ️</span>
        <span>
          {lang === "en"
            ? "This page is for product-level sales analysis only (which products sell, prescription vs. retail mix, trends). It does NOT feed into your Dashboard's Total Income/Expense or the Monthly Summary — those come from Kasa (POS/Cash/Wire) entries, which you enter separately. Importing sales data here will not double-count or change your Kasa totals."
            : "Bu sayfa yalnızca ürün bazlı satış analizi içindir (hangi ürünler satılıyor, reçeteli/perakende dağılımı, trendler). Gösterge panelindeki Toplam Gelir/Gider'i veya Aylık Özet'i ETKİLEMEZ — o rakamlar ayrıca girdiğiniz Kasa (POS/Nakit/Havale) kayıtlarından gelir. Buraya satış verisi aktarmak Kasa toplamlarınızı değiştirmez veya çift saymaz."}
        </span>
      </div>

      {/* Son Yükleme özeti — kullanıcı ayrıca "İçe Aktarma Geçmişi" sekmesine
          girmeden en son yüklemenin ne zaman/kaç kayıt/hangi tarih aralığı
          olduğunu bir bakışta görsün diye. Henüz hiç yükleme yoksa (batches
          boş) hiçbir şey göstermez — bozuk/boş bir kart yerine sessizce geçilir. */}
      {tab !== "history" && batches.length > 0 && (() => {
        const last = batches[0];
        const rangeText = last.dateRangeStart && last.dateRangeEnd
          ? `${format(parseDateOnlyLocal(last.dateRangeStart), "dd MMM yyyy", { locale: lang === "en" ? enUS : tr })} – ${format(parseDateOnlyLocal(last.dateRangeEnd), "dd MMM yyyy", { locale: lang === "en" ? enUS : tr })}`
          : null;
        return (
          <div style={{
            marginBottom: "var(--spacing-5)", padding: "12px 16px", background: "var(--color-surface)",
            border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "13px",
            color: "var(--color-text)", display: "flex", gap: "10px", alignItems: "flex-start",
          }}>
            <span style={{ fontSize: "16px", flexShrink: 0 }}>🕒</span>
            <span>
              <strong>{lang === "en" ? "Last Upload: " : "Son Yükleme: "}</strong>
              {last.importDate ? format(new Date(last.importDate), "dd MMMM yyyy, HH:mm", { locale: lang === "en" ? enUS : tr }) : "—"}
              {" · "}
              {last.recordCount.toLocaleString("tr-TR")} {lang === "en" ? "records" : "kayıt"}
              {rangeText && <> {" · "}{rangeText} {lang === "en" ? "range" : "aralığı"}</>}
            </span>
          </div>
        );
      })()}
      {tab !== "history" && batches.length === 0 && !batchesLoading && (
        <div style={{
          marginBottom: "var(--spacing-5)", padding: "10px 16px", color: "var(--color-text-muted)",
          fontSize: "13px",
        }}>
          {lang === "en" ? "No data uploaded yet." : "Henüz veri yüklenmedi."}
        </div>
      )}

      {/* ── DOSYA İÇE AKTAR ── */}
      {tab === "upload" && (
        <div style={{ maxWidth: "800px" }}>

          {/* Adım göstergesi */}
          <div style={{ display: "flex", marginBottom: "var(--spacing-5)", borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--color-border)" }}>
            {([
              { id: "select",  label: lang === "en" ? "1. Select File" : "1. Dosya Seç", icon: "📂" },
              { id: "mapping", label: lang === "en" ? "2. Map Columns" : "2. Kolon Eşleştir", icon: "🔧" },
              { id: "preview", label: lang === "en" ? "3. Confirm & Save" : "3. Onayla & Kaydet", icon: "✅" },
            ] as const).map((s, i, arr) => (
              <div key={s.id} style={{
                flex: 1, padding: "10px 16px", textAlign: "center", fontSize: "13px", fontWeight: 600,
                background: step === s.id ? "var(--color-primary)" : "var(--color-bg)",
                color: step === s.id ? "white" : "var(--color-text-muted)",
                borderRight: i < arr.length - 1 ? "1px solid var(--color-border)" : "none",
              }}>
                {s.icon} {s.label}
              </div>
            ))}
          </div>

          {parseError && (
            <div style={{ padding: "12px", background: "var(--color-danger-bg, #fee2e2)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "16px", fontSize: "14px" }}>
              ❌ {parseError}
            </div>
          )}

          {/* ADIM 1 */}
          {step === "select" && (
            <div className="card">
              <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "var(--spacing-2)" }}>{lang === "en" ? "Upload Sales File" : "Satış Dosyası Yükle"}</h2>
              <p style={{ color: "var(--color-text-muted)", fontSize: "14px", marginBottom: "var(--spacing-4)" }}>
                {lang === "en" ? "Select the Excel/CSV file exported from your pharmacy software (Logo, Urus, EYS, etc.)." : "Eczane yazılımından (Logo, Urus, EYS vb.) dışa aktarılan Excel/CSV dosyasını seçin."}
              </p>

              <label htmlFor="sale-file-input" style={{
                display: "block", border: "2px dashed var(--color-border)", borderRadius: "var(--radius-lg)",
                padding: "36px", textAlign: "center", background: "var(--color-bg)",
                cursor: "pointer", marginBottom: "var(--spacing-4)",
              }}>
                <div style={{ fontSize: "44px", marginBottom: "10px" }}>{file ? "📄" : "📊"}</div>
                <p style={{ fontWeight: 600, fontSize: "15px", marginBottom: "4px" }}>
                  {file ? file.name : (lang === "en" ? "Click to select a file" : "Dosya seçmek için tıklayın")}
                </p>
                <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "xlsx · xls · csv · pdf"}
                </p>
                <input id="sale-file-input" type="file" accept=".csv,.xlsx,.xls,.pdf"
                  style={{ display: "none" }} onChange={handleFilePick} />
              </label>

              <button className="btn btn-primary btn-full" disabled={!file || parsing} onClick={() => void handleReadFile()}>
                {parsing ? (lang === "en" ? "Reading File..." : "Dosya Okunuyor...") : (lang === "en" ? "Read File →" : "Dosyayı Oku →")}
              </button>
            </div>
          )}

          {/* ADIM 2: Kolon Eşleştirme */}
          {step === "mapping" && columnMap && (
            <div className="card">
              <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "6px" }}>{lang === "en" ? "Column Mapping" : "Kolon Eşleştirme"}</h2>
              <p style={{ color: "var(--color-text-muted)", fontSize: "14px", marginBottom: "var(--spacing-4)" }}>
                {lang === "en" ? "System auto-mapped the columns. Fix any wrong fields, then click \"Go to Preview\"." : "Sistem otomatik eşleştirdi. Yanlış alanları düzeltin, sonra \"Önizlemeye Geç\"e tıklayın."}
              </p>

              {effectiveIsNet() && (
                <div style={{ padding: "12px 14px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-4)", fontSize: "13px" }}>
                  <p style={{ fontWeight: 700, color: "#b45309", marginBottom: "4px" }}>⚠ {lang === "en" ? "Net Amount Mode Active" : "Net Tutar Modu Aktif"}</p>
                  <p style={{ color: "#92400e" }}>
                    {lang === "en"
                      ? "The selected price column already contains total revenue — it will not be multiplied by quantity. If this is correct, continue. If you have a unit price column, change it below."
                      : "Seçilen fiyat kolonu zaten toplam geliri içeriyor — adet ile çarpılmayacak. Bu doğruysa devam edin. Birim fiyat kolonunuz varsa aşağıdan değiştirin."}
                  </p>
                </div>
              )}

              <div className="responsive-grid responsive-grid-1-1" style={{ gap: "var(--spacing-4)" }}>
                <ColSelect fieldKey="price" label={lang === "en" ? "Price Column *" : "Fiyat Kolonu *"}
                  hint={lang === "en" ? "'Unit Price' = qty × price calculated · 'Amount/Net Amount' = already total" : "'Birim Fiyat' = adet × fiyat hesaplanır · 'Tutar/Net Tutar' = zaten toplam"}
                  headers={headers} dataRows={dataRows} selected={effectiveMap("price")} lang={lang} onChange={setOvr} />

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{lang === "en" ? "Price Type" : "Fiyat Türü"}</label>
                  <select className="form-input"
                    value={effectiveIsNet() ? "net" : "unit"}
                    onChange={e => setOvr("priceIsNet", e.target.value === "net")}>
                    <option value="unit">{lang === "en" ? "Unit Price (Qty × Price calculated)" : "Birim Fiyat (Adet × Fiyat hesaplanır)"}</option>
                    <option value="net">{lang === "en" ? "Net Amount (Already total, no multiplication)" : "Net Tutar (Zaten toplam, çarpma yapılmaz)"}</option>
                  </select>
                </div>

                <ColSelect fieldKey="quantity" label={lang === "en" ? "Quantity Column" : "Adet Kolonu"}
                  headers={headers} dataRows={dataRows} selected={effectiveMap("quantity")} lang={lang} onChange={setOvr} />
                <ColSelect fieldKey="discount" label={lang === "en" ? "Discount Column" : "İskonto Kolonu"}
                  headers={headers} dataRows={dataRows} selected={effectiveMap("discount")} lang={lang} onChange={setOvr} />
                <ColSelect fieldKey="name" label={lang === "en" ? "Product Name Column *" : "Ürün Adı Kolonu *"}
                  headers={headers} dataRows={dataRows} selected={effectiveMap("name")} lang={lang} onChange={setOvr} />
                <ColSelect fieldKey="date" label={lang === "en" ? "Date Column *" : "Tarih Kolonu *"}
                  headers={headers} dataRows={dataRows} selected={effectiveMap("date")} lang={lang} onChange={setOvr} />
                <ColSelect fieldKey="group" label={lang === "en" ? "Product Group Column" : "Ürün Grubu Kolonu"}
                  headers={headers} dataRows={dataRows} selected={effectiveMap("group")} lang={lang} onChange={setOvr} />
                <ColSelect fieldKey="type" label={lang === "en" ? "Sale Type Column" : "Satış Tipi Kolonu"}
                  hint={lang === "en" ? "Distinguishes Prescription/SGK from Retail/Direct" : "Reçeteli/SGK veya Perakende/Elden ayrımı"}
                  headers={headers} dataRows={dataRows} selected={effectiveMap("type")} lang={lang} onChange={setOvr} />
                <ColSelect fieldKey="staff" label={lang === "en" ? "Staff Column (optional)" : "Personel Kolonu (opsiyonel)"}
                  hint={lang === "en" ? "Only if your file has a staff/employee column" : "Dosyanızda personel/çalışan sütunu varsa"}
                  headers={headers} dataRows={dataRows} selected={effectiveMap("staff")} lang={lang} onChange={setOvr} />
              </div>

              <div style={{ display: "flex", gap: "var(--spacing-3)", marginTop: "var(--spacing-5)" }}>
                <button className="btn" onClick={resetUpload}>{lang === "en" ? "← Back" : "← Geri"}</button>
                <button className="btn btn-primary" onClick={handleApplyMapping}>
                  {lang === "en" ? "Go to Preview →" : "Önizlemeye Geç →"}
                </button>
              </div>
            </div>
          )}

          {/* ADIM 3: Önizleme */}
          {step === "preview" && previewRows.length > 0 && (
            <div>
              <div className="responsive-grid responsive-grid-5-cols" style={{ gap: "var(--spacing-3)", marginBottom: "var(--spacing-4)" }}>
                {[
                  { label: lang === "en" ? "Records to Save" : "Kaydedilecek Kayıt", value: validPreviewRows.length.toLocaleString("tr-TR") },
                  { label: lang === "en" ? "Prescription (SGK)" : "Reçeteli (SGK)", value: validPreviewRows.filter(r => r.saleType === "PRESCRIPTION").length.toLocaleString("tr-TR") },
                  { label: lang === "en" ? "Retail" : "Perakende", value: validPreviewRows.filter(r => r.saleType === "RETAIL").length.toLocaleString("tr-TR") },
                  { label: lang === "en" ? "Avg. per Sale" : "Satış Başına Ort.", value: fmt(validPreviewRows.length > 0 ? totalNetRevenue / validPreviewRows.length : 0) },
                  { label: lang === "en" ? "Total Revenue" : "Toplam Ciro", value: fmt(totalNetRevenue), highlight: true },
                ].map(c => (
                  <div key={c.label} className="card" style={{ padding: "var(--spacing-3)" }}>
                    <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>{c.label}</div>
                    <div style={{ fontSize: c.highlight ? "var(--font-size-lg)" : "var(--font-size-base)", fontWeight: 700, color: c.highlight ? "var(--color-primary)" : undefined }}>{c.value}</div>
                  </div>
                ))}
              </div>

              {invalidDateRows.length > 0 && (
                <div style={{ padding: "12px 14px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-4)", fontSize: "13px" }}>
                  <p style={{ fontWeight: 700, color: "#b45309", marginBottom: "4px" }}>
                    ⚠ {lang === "en"
                      ? `${invalidDateRows.length} row(s) have an unparseable date and will NOT be saved`
                      : `${invalidDateRows.length} satırda tarih ayrıştırılamadı, bu satırlar kaydedilMEyecek`}
                  </p>
                  <p style={{ color: "#92400e", marginBottom: "6px" }}>
                    {lang === "en"
                      ? "These rows are excluded from the save to avoid silently dating them to today. Fix the source file and re-upload if needed."
                      : "Bu satırlar, sessizce bugünün tarihine kaydedilmesini önlemek için kayıttan hariç tutulur. Gerekirse kaynak dosyanızı düzeltip tekrar yükleyin."}
                  </p>
                  <button className="btn" style={{ padding: "2px 8px", fontSize: "11px" }} onClick={() => setShowInvalidDateDetail(v => !v)}>
                    {showInvalidDateDetail
                      ? (lang === "en" ? "Hide details" : "Detayı gizle")
                      : (lang === "en" ? "Show details" : "Detayı göster")}
                  </button>
                  {showInvalidDateDetail && (
                    <div style={{ marginTop: "8px", maxHeight: "180px", overflowY: "auto", WebkitOverflowScrolling: "touch", border: "1px solid #fed7aa", borderRadius: "var(--radius-sm)" }}>
                      <table className="table" style={{ width: "100%", fontSize: "12px" }}>
                        <thead>
                          <tr>
                            <th>{lang === "en" ? "Row #" : "Satır #"}</th>
                            <th>{lang === "en" ? "Product Name" : "Ürün Adı"}</th>
                            <th>{lang === "en" ? "Raw Date Value" : "Ham Tarih Değeri"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invalidDateRows.map(({ r, i }) => (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td>{r.productName}</td>
                              <td>{r.rawDateValue?.trim() ? `"${r.rawDateValue}"` : (lang === "en" ? "(empty)" : "(boş)")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {columnMap && (
                <div style={{ padding: "10px 14px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-4)", fontSize: "12px", color: "var(--color-text-muted)" }}>
                  {lang === "en" ? "Mapped from: " : "Eşleştirilen sütunlar: "}
                  <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
                    {`${lang === "en" ? "Name" : "Ad"}="${columnMap.name}", ${lang === "en" ? "Date" : "Tarih"}="${columnMap.date}", ${lang === "en" ? "Price" : "Fiyat"}="${columnMap.price}"`}
                    {columnMap.priceIsNet
                      ? ` (${lang === "en" ? "net amount, not multiplied by qty" : "net tutar, adetle çarpılmadı"})`
                      : `, ${lang === "en" ? "Qty" : "Adet"}="${columnMap.quantity}"`}
                  </span>
                  {" — "}
                  <button className="btn" style={{ padding: "2px 8px", fontSize: "11px" }} onClick={() => setStep("mapping")}>
                    {lang === "en" ? "wrong? edit" : "yanlışsa düzelt"}
                  </button>
                </div>
              )}

              <div style={{ display: "flex", gap: "var(--spacing-3)", marginBottom: "var(--spacing-4)", flexWrap: "wrap" }}>
                <button className="btn" onClick={() => setStep("mapping")}>{lang === "en" ? "← Edit Columns" : "← Kolonları Düzenle"}</button>
                <button className="btn btn-primary" disabled={saving || checkingOverlap || validPreviewRows.length === 0} onClick={() => void handleConfirm()} style={{ minWidth: "240px" }}>
                  {checkingOverlap
                    ? (lang === "en" ? "Checking for overlapping data..." : "Çakışan veri kontrol ediliyor...")
                    : saving
                    ? (saveProgress
                        ? (lang === "en"
                            ? `Saving... (${saveProgress.done}/${saveProgress.total})`
                            : `Kaydediliyor... (${saveProgress.done}/${saveProgress.total})`)
                        : (lang === "en" ? "Saving..." : "Kaydediliyor..."))
                    : (lang === "en"
                        ? `Confirm & Save ${validPreviewRows.length.toLocaleString("en-US")} Sales`
                        : `${validPreviewRows.length.toLocaleString("tr-TR")} Satışı Onayla ve Kaydet`)}
                </button>
              </div>

              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--color-border)", fontWeight: 700, fontSize: "14px" }}>
                  {lang === "en" ? "Preview — First 50 Rows" : "Önizleme — İlk 50 Satır"}
                </div>
                <div style={{ overflowX: "auto", maxHeight: "480px", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                  <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                    <thead style={{ position: "sticky", top: 0, background: "var(--color-surface)" }}>
                      <tr>
                        <th>#</th>
                        <th>{lang === "en" ? "Date" : "Tarih"}</th>
                        <th>{lang === "en" ? "Product Name" : "Ürün Adı"}</th>
                        <th>{lang === "en" ? "Group" : "Grup"}</th>
                        <th>{lang === "en" ? "Qty" : "Adet"}</th>
                        <th>{lang === "en" ? "Price" : "Fiyat"}</th>
                        <th>{lang === "en" ? "Discount" : "İskonto"}</th>
                        <th>{lang === "en" ? "Net Revenue" : "Net Gelir"}</th>
                        <th>{lang === "en" ? "Type" : "Tip"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 50).map((row, i) => {
                        const b = badge(row.saleType, lang);
                        return (
                          <tr key={i}>
                            <td style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{i + 1}</td>
                            <td style={{ whiteSpace: "nowrap", fontSize: "12px" }}>{row.saleDate.split("T")[0]}</td>
                            <td style={{ fontWeight: 500 }}>{row.productName}</td>
                            <td style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{row.productGroup}</td>
                            <td>{row.quantity}</td>
                            <td>{row.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                            <td style={{ color: row.discountAmount > 0 ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                              {row.discountAmount > 0 ? `−${row.discountAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "—"}
                            </td>
                            <td style={{ fontWeight: 700 }}>{row.netRevenue.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                            <td>
                              <span style={{ padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 600, background: b.bg, color: b.color }}>
                                {b.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {previewRows.length > 50 && (
                  <div style={{ padding: "10px 18px", color: "var(--color-text-muted)", fontSize: "13px", borderTop: "1px solid var(--color-border)" }}>
                    {lang === "en"
                    ? `+ ${(previewRows.length - 50).toLocaleString("tr-TR")} more rows — ${previewRows.length.toLocaleString("tr-TR")} total records will be saved`
                    : `+ ${(previewRows.length - 50).toLocaleString("tr-TR")} satır daha — toplam ${previewRows.length.toLocaleString("tr-TR")} kayıt kaydedilecek`}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SATIŞ LİSTESİ ── */}
      {tab === "list" && (
        <div>
          <div className="card" style={{ marginBottom: "var(--spacing-5)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacing-4)", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 480px", minWidth: 0 }}>
                {/* Hazır aralık ("preset") butonları */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "var(--spacing-3)" }}>
                  {DATE_RANGE_PRESETS.map(preset => {
                    const isActive = activePresetKey === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => { const r = preset.range(); handlePresetClick(r.start, r.end); }}
                        disabled={listLoading}
                        style={{
                          padding: "5px 12px",
                          fontSize: "12.5px",
                          fontWeight: 600,
                          borderRadius: "var(--radius-full)",
                          border: `1px solid ${isActive ? "var(--color-primary)" : "var(--color-border)"}`,
                          background: isActive ? "var(--color-primary)" : "var(--color-surface)",
                          color: isActive ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
                          cursor: listLoading ? "not-allowed" : "pointer",
                          opacity: listLoading ? 0.6 : 1,
                          whiteSpace: "nowrap",
                          transition: "all var(--transition-fast, 0.15s)",
                        }}
                      >
                        {lang === "en" ? preset.labelEn : preset.labelTr}
                      </button>
                    );
                  })}
                </div>

                <div className="responsive-grid responsive-grid-3-cols" style={{ gap: "var(--spacing-3)", alignItems: "flex-end", maxWidth: "560px" }}>
                  <div className="form-group" style={{ marginBottom: 0, gridColumn: "span 2" }}>
                    <label className="form-label">{lang === "en" ? "Date Range" : "Tarih Aralığı"}</label>
                    <DateRangePicker
                      startDate={pendingStartDate}
                      endDate={pendingEndDate}
                      lang={lang === "en" ? "en" : "tr"}
                      onChange={(start, end) => { setPendingStartDate(start); setPendingEndDate(end); }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{lang === "en" ? "Sale Type" : "Satış Tipi"}</label>
                    <select className="form-input" value={pendingFilterType} onChange={e => setPendingFilterType(e.target.value as "" | "PRESCRIPTION" | "RETAIL")}>
                      <option value="">{lang === "en" ? "All" : "Tümü"}</option>
                      <option value="PRESCRIPTION">{lang === "en" ? "Prescription (SGK)" : "Reçeteli (SGK)"}</option>
                      <option value="RETAIL">{lang === "en" ? "Retail (Direct)" : "Perakende (Elden)"}</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-3)", marginTop: "var(--spacing-3)", flexWrap: "wrap" }}>
                  <button className="btn btn-primary" onClick={handleApplyFilters} disabled={listLoading}>
                    {listLoading ? (lang === "en" ? "Loading..." : "Yükleniyor...") : (lang === "en" ? "Filter" : "Filtrele")}
                  </button>
                  <span style={{ fontSize: "12.5px", color: "var(--color-text-muted)" }}>
                    {lang === "en" ? "Showing: " : "Gösterilen: "}
                    <strong style={{ color: "var(--color-text)", fontWeight: 600 }}>
                      {format(parseDateOnlyLocal(startDate), "dd MMM yyyy", { locale: lang === "en" ? enUS : tr })}
                      {" – "}
                      {format(parseDateOnlyLocal(endDate), "dd MMM yyyy", { locale: lang === "en" ? enUS : tr })}
                    </strong>
                    {pendingDiffersFromApplied && (
                      <span style={{ color: "var(--color-warning)", marginLeft: "8px" }}>
                        {lang === "en" ? "· Unapplied changes — press Filter" : "· Uygulanmamış değişiklik — Filtrele'ye basın"}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn" onClick={() => { setTab("upload"); setStep("select"); }}
                style={{ border: "1px solid var(--color-primary)", color: "var(--color-primary)", fontWeight: 600, fontSize: "13px" }}>
                📤 {lang === "en" ? "Import Data" : "Veri Aktar"}
              </button>
              {records.length > 0 && (
                <button className="btn" onClick={() => void handleClearAll()} disabled={clearingAll}
                  style={{ background: "var(--color-danger)", color: "white", fontSize: "13px" }}>
                  {clearingAll ? (lang === "en" ? "Deleting..." : "Siliniyor...") : (lang === "en" ? "🗑 Clear All Records" : "🗑 Tüm Kayıtları Temizle")}
                </button>
              )}
            </div>
            </div>
          </div>

          {summary && (
            <div className="responsive-grid responsive-grid-3-cols" style={{ gap: "var(--spacing-4)", marginBottom: "var(--spacing-5)" }}>
              <div className="card" style={{ padding: "var(--spacing-4)" }}>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>{lang === "en" ? "Total Revenue" : "Toplam Ciro"}</div>
                <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 800, color: "var(--color-primary)" }}>{fmt(summary.totalRevenue)}</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "4px" }}>
                  {summary.totalRecords.toLocaleString("tr-TR")} {lang === "en" ? "sales" : "satış"}
                  {" · "}
                  {dailyRevenueData.length.toLocaleString("tr-TR")} {lang === "en" ? "day(s) with data" : "farklı gün"}
                  {" "}({startDate} – {endDate})
                </div>
              </div>
              <div className="card" style={{ padding: "var(--spacing-4)" }}>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>{lang === "en" ? "Prescription / SGK" : "Reçeteli / SGK"}</div>
                <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 700 }}>
                  {fmt(summary.prescriptionRevenue)}
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-muted)", marginLeft: "6px" }}>
                    (%{summary.totalRevenue > 0 ? ((summary.prescriptionRevenue / summary.totalRevenue) * 100).toFixed(0) : 0})
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "4px" }}>{summary.prescriptionCount.toLocaleString("tr-TR")} {lang === "en" ? "sales" : "satış"}</div>
              </div>
              <div className="card" style={{ padding: "var(--spacing-4)" }}>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>{lang === "en" ? "Retail / Direct" : "Perakende / Elden"}</div>
                <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 700 }}>
                  {fmt(summary.retailRevenue)}
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-muted)", marginLeft: "6px" }}>
                    (%{summary.totalRevenue > 0 ? ((summary.retailRevenue / summary.totalRevenue) * 100).toFixed(0) : 0})
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "4px" }}>{summary.retailCount.toLocaleString("tr-TR")} {lang === "en" ? "sales" : "satış"}</div>
              </div>
            </div>
          )}

          {summary && summary.prescriptionRevenue > 0 && (
            <div className="card" style={{
              marginBottom: "var(--spacing-5)", padding: "var(--spacing-4)",
              border: `1px solid ${sgkDiffIsWarning ? "var(--color-warning-border)" : "var(--color-info-border)"}`,
              background: sgkDiffIsWarning ? "var(--color-warning-bg)" : "var(--color-info-bg)",
            }}>
              <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-3)" }}>
                {lang === "en" ? "Prescription vs. SGK Invoice Cross-Check" : "Reçete / SGK Fatura Karşılaştırması"}
              </h3>
              <div className="responsive-grid responsive-grid-1-1" style={{ gap: "var(--spacing-4)" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                    {lang === "en" ? "This Month Prescription Sales (Sales Report)" : "Bu Ay Reçeteli Satış (Satış Raporu)"}
                  </div>
                  <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 700 }}>{formatCurrency(prescriptionRevenueThisPeriod)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                    {lang === "en" ? "This Month Invoiced to SGK" : "Bu Ay SGK Faturalandı"}
                  </div>
                  <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 700 }}>
                    {sgkLoading ? "…" : sgkInvoicedThisMonth !== null ? formatCurrency(sgkInvoicedThisMonth) : (lang === "en" ? "No data" : "Veri yok")}
                  </div>
                </div>
              </div>
              {sgkDiffPct !== null && (
                <div style={{ marginTop: "var(--spacing-3)", fontSize: "13px", fontWeight: 600, color: sgkDiffIsWarning ? "var(--color-warning)" : "var(--color-info)" }}>
                  {sgkDiffIsWarning ? "⚠ " : "ℹ "}
                  {lang === "en" ? `Difference: %${sgkDiffPct.toFixed(1)}` : `Fark: %${sgkDiffPct.toFixed(1)}`}
                </div>
              )}
              <p style={{ marginTop: "var(--spacing-2)", fontSize: "12px", color: "var(--color-text-muted)" }}>
                {lang === "en"
                  ? "This comparison is for information only and does not affect your official revenue calculation."
                  : "Bu karşılaştırma yalnızca bilgilendirme amaçlıdır, resmi ciro hesaplamanızı etkilemez."}
              </p>
            </div>
          )}

          {records.length > 0 && summary && (
            <div style={{ marginBottom: "var(--spacing-5)" }}>
              <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "var(--spacing-3)" }}>
                {lang === "en" ? "Click a bar/point/slice for details" : "Detay için bir çubuğa/noktaya/dilime tıklayın"}
              </p>

              <div className="responsive-grid responsive-grid-2-1" style={{ gap: "var(--spacing-6)", marginBottom: "var(--spacing-6)" }}>
                <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
                  <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>{lang === "en" ? "Daily Revenue Trend" : "Günlük Ciro Trendi"}</h3>
                  <DailyRevenueChart
                    data={dailyRevenueData}
                    lang={lang}
                    onPointClick={(date) => {
                      const dayRecords = records.filter(r => r.saleDate.split("T")[0] === date);
                      const label = format(parseDateOnlyLocal(date), "dd MMMM yyyy", { locale: lang === "en" ? enUS : tr });
                      setDrillDown({
                        title: lang === "en" ? `${label} — ${dayRecords.length} sales` : `${label} — ${dayRecords.length} satış`,
                        records: dayRecords,
                      });
                    }}
                  />
                </section>

                <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
                  <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>{lang === "en" ? "Prescription vs Retail Distribution" : "Reçeteli vs Perakende Dağılımı"}</h3>
                  <TypeDistributionPieChart
                    prescriptionRevenue={summary.prescriptionRevenue}
                    retailRevenue={summary.retailRevenue}
                    lang={lang}
                    onSliceClick={(type) => {
                      const filtered = records.filter(r => r.saleType === type);
                      const b = badge(type, lang);
                      setDrillDown({
                        title: lang === "en" ? `${b.label} — ${filtered.length} sales` : `${b.label} — ${filtered.length} satış`,
                        records: filtered,
                      });
                    }}
                  />
                </section>
              </div>

              {groupRevenueQuantityData.length > 0 && (
                <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)", marginBottom: "var(--spacing-6)" }}>
                  <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>{lang === "en" ? "Revenue/Quantity by Product Category" : "Kategori Bazında Ciro/Adet Dağılımı"}</h3>
                  {!hasRealGroupData ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                      {lang === "en"
                        ? "This file has no product group/category information, so a category breakdown cannot be shown."
                        : "Bu dosyada ürün grubu bilgisi yok."}
                    </div>
                  ) : (
                    <GroupRevenueQuantityChart
                      data={groupRevenueQuantityData}
                      lang={lang}
                      onBarClick={(group) => {
                        const otherLabel = lang === "en" ? "Other" : "Diğer";
                        const isOtherBucket = group === otherLabel;
                        const topGroupNames = new Set(groupRevenueQuantityData.filter(g => g.group !== otherLabel).map(g => g.group));
                        const filtered = isOtherBucket
                          ? records.filter(r => !topGroupNames.has(r.productGroup || "Genel"))
                          : records.filter(r => (r.productGroup || "Genel") === group);
                        setDrillDown({
                          title: lang === "en" ? `${group} — ${filtered.length} sales` : `${group} — ${filtered.length} satış`,
                          records: filtered,
                        });
                      }}
                    />
                  )}
                </section>
              )}

              {topProductsData.length > 0 && (
                <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
                  <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>{lang === "en" ? "Top 10 Best-Selling Products" : "En Çok Satan 10 Ürün"}</h3>
                  <TopProductsChart
                    data={topProductsData}
                    lang={lang}
                    onBarClick={(name) => {
                      const filtered = records.filter(r => r.productName === name);
                      setDrillDown({
                        title: lang === "en" ? `${name} — ${filtered.length} sales` : `${name} — ${filtered.length} satış`,
                        records: filtered,
                      });
                    }}
                  />
                </section>
              )}

              <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)", marginTop: "var(--spacing-6)" }}>
                <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "4px" }}>{lang === "en" ? "Staff Performance" : "Personel Bazlı Performans"}</h3>
                {hasStaffColumn ? (
                  <StaffPerformanceTable data={staffPerformanceData} lang={lang} />
                ) : (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                    {lang === "en"
                      ? "No staff column found in imported files. Import a file with a 'Personel' column to see this breakdown."
                      : "İçe aktarılan dosyalarda personel sütunu bulunamadı. Bu dökümü görmek için 'Personel' sütunu içeren bir dosya yükleyin."}
                  </div>
                )}
              </section>

              <div className="responsive-grid responsive-grid-1-1" style={{ gap: "var(--spacing-6)", marginTop: "var(--spacing-6)" }}>
                <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
                  <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "4px" }}>{lang === "en" ? "Day-of-Week Density" : "Haftanın Günü Bazında Yoğunluk"}</h3>
                  <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "var(--spacing-3)" }}>
                    {lang === "en"
                      ? "Average revenue by day of week, across all sale types (see \"Hour-of-Day Sales Density\" below for hourly detail, when available)."
                      : "Tüm satış tipleri genelinde haftanın günü bazında ortalama ciro (saat bazlı detay için aşağıdaki \"Saat Bazlı Yoğunluk Analizi\"ne bakın, dosyada saat bilgisi varsa)."}
                  </p>
                  <DayOfWeekChart data={dayOfWeekData} lang={lang} />
                </section>

                <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
                  <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "4px" }}>{lang === "en" ? "Avg. Order Value (AOV) & Discount Rate Trend" : "Ortalama Sepet Tutarı (AOV) ve İskonto Oranı Trendi"}</h3>
                  <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 800, color: "var(--color-primary)", margin: "4px 0 var(--spacing-3)" }}>
                    {lang === "en" ? "Avg. Order Value: " : "Ortalama Sepet Tutarı: "}{fmt(overallAov)}
                  </div>
                  {periodTrendData.length > 0 ? (
                    <TrendChart data={periodTrendData} lang={lang} />
                  ) : (
                    <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                      {lang === "en" ? "Not enough data for this period." : "Bu dönem için yeterli veri yok."}
                    </div>
                  )}
                </section>
              </div>

              {/* #2 İşlem/Ödeme Tiplerine Göre Satış Dağılımı */}
              <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)", marginTop: "var(--spacing-6)" }}>
                <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "4px" }}>{lang === "en" ? "Sales by Transaction / Payment Type" : "İşlem ve Ödeme Tiplerine Göre Satış Dağılımı"}</h3>
                <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "var(--spacing-3)" }}>
                  {lang === "en" ? "Based on the raw 'Transaction Type' column (e.g. card vs. cash vs. prescription)." : "Ham 'İşlem Tipi' sütununa göre (ör. kredi kartı, nakit, reçeteli ayrımı)."}
                </p>
                {transactionTypeData.length > 0 ? (
                  <TransactionTypeChart data={transactionTypeData} lang={lang} />
                ) : (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                    {lang === "en" ? "No transaction type column detected in imported files." : "İçe aktarılan dosyalarda işlem tipi sütunu tespit edilmedi."}
                  </div>
                )}
              </section>

              {/* #3 Reçeteli / Perakende Karşılaştırması (genişletilmiş) */}
              <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)", marginTop: "var(--spacing-6)" }}>
                <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>{lang === "en" ? "Prescription vs Retail (OTC) Comparison" : "Reçeteli ve Perakende (OTC) Satış Karşılaştırması"}</h3>
                <RechVsRetailComparisonChart
                  prescriptionRevenue={summary.prescriptionRevenue}
                  retailRevenue={summary.retailRevenue}
                  prescriptionCount={summary.prescriptionCount}
                  retailCount={summary.retailCount}
                  lang={lang}
                />
              </section>

              {/* #6 Haftanın Günlerine Göre Perakende Satış Yoğunluğu (Yeni) */}
              <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)", marginTop: "var(--spacing-6)" }}>
                <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "4px" }}>{lang === "en" ? "Day-of-Week Retail Density (New)" : "Haftanın Günlerine Göre Perakende Satış Yoğunluğu (Yeni)"}</h3>
                <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "var(--spacing-3)" }}>
                  {lang === "en" ? "Same metric as above, but scoped to RETAIL sales only (excludes prescription/SGK)." : "Yukarıdakiyle aynı metrik, ancak SADECE perakende satışlar (reçeteli/SGK hariç)."}
                </p>
                <DayOfWeekChart data={dayOfWeekRetailData} lang={lang} />
              </section>

              {/* Saat Bazlı Yoğunluk Analizi */}
              <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)", marginTop: "var(--spacing-6)" }}>
                <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "4px" }}>{lang === "en" ? "Hour-of-Day Sales Density" : "Saat Bazlı Yoğunluk Analizi"}</h3>
                {hourlyDensityData.length > 0 ? (
                  <>
                    <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "var(--spacing-3)" }}>
                      {lang === "en" ? "Total revenue by transaction hour (only hours with data are shown)." : "İşlem saatine göre toplam ciro (yalnızca veri içeren saatler gösteriliyor)."}
                    </p>
                    <HourlyDensityChart data={hourlyDensityData} lang={lang} />
                  </>
                ) : (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                    {lang === "en"
                      ? "This file has no time information, hourly density cannot be shown."
                      : "Bu dosyada saat bilgisi yok, saatlik yoğunluk gösterilemiyor."}
                  </div>
                )}
              </section>

              {/* Hızlı Tükenen Ürünler Sinyali */}
              <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)", marginTop: "var(--spacing-6)" }}>
                <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "4px" }}>{lang === "en" ? "Fast-Moving / Low-Stock Signal" : "Hızlı Tükenen Ürünler Sinyali"}</h3>
                {hasStockData ? (
                  <>
                    <p style={{ fontSize: "11px", fontStyle: "italic", color: "var(--color-text-muted)", marginBottom: "var(--spacing-3)" }}>
                      {lang === "en"
                        ? "This list is based on the point-in-time stock value in the sales file — for real-time stock tracking, use the Stock Inventory module."
                        : "Bu liste satış dosyasındaki anlık stok bilgisine dayanır, gerçek zamanlı stok takibi için Stok Envanteri modülünü kullanın."}
                    </p>
                    <FastMovingStockTable data={fastMovingStockData} lang={lang} />
                  </>
                ) : (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                    {lang === "en"
                      ? "This file has no stock quantity column, this signal cannot be shown."
                      : "Bu dosyada stok adet sütunu yok, bu sinyal gösterilemiyor."}
                  </div>
                )}
              </section>

            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", fontWeight: 700, fontSize: "14px" }}>
              {lang === "en" ? "Sales Records" : "Satış Kayıtları"}{summary ? ` (${summary.totalRecords.toLocaleString("tr-TR")})` : ""}
            </div>
            {listLoading ? (
              <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /></div>
            ) : records.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--color-text-muted)" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>📊</div>
                <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>{lang === "en" ? "No Sales Records for Selected Period" : "Seçilen Dönemde Satış Kaydı Yok"}</p>
                <p style={{ fontSize: "14px", marginBottom: "16px" }}>{lang === "en" ? "Change the date range or import sales data." : "Tarih aralığını değiştirin veya satış verisi aktarın."}</p>
                <button className="btn btn-primary" onClick={() => { setTab("upload"); setStep("select"); }}>
                  📤 {lang === "en" ? "Import Data" : "Veri Aktar"}
                </button>
              </div>
            ) : (
              <div style={{ overflowX: "auto", maxHeight: "520px", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--color-surface)" }}>
                    <tr>
                      <th>{lang === "en" ? "Date" : "Tarih"}</th>
                      <th>{lang === "en" ? "Product Name" : "Ürün Adı"}</th>
                      <th>{lang === "en" ? "Group" : "Grup"}</th>
                      <th>{lang === "en" ? "Qty" : "Adet"}</th>
                      <th>{lang === "en" ? "Net Revenue" : "Net Gelir"}</th>
                      <th>{lang === "en" ? "Type" : "Tip"}</th>
                      <th style={{ textAlign: "right" }}>{lang === "en" ? "Actions" : "İşlem"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => {
                      const b = badge(r.saleType, lang);
                      return (
                        <tr key={r.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{format(parseDateOnlyLocal(r.saleDate), "dd MMM yyyy", { locale: lang === "en" ? enUS : tr })}</td>
                          <td style={{ fontWeight: 500 }}>{r.productName}</td>
                          <td style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{r.productGroup}</td>
                          <td>{r.quantity}</td>
                          <td style={{ fontWeight: 700 }}>{r.netRevenue.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                          <td>
                            <span style={{ padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 600, background: b.bg, color: b.color }}>
                              {b.label}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button onClick={() => setDeleteId(r.id)}
                              style={{ padding: "3px 8px", fontSize: "11px", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                              {lang === "en" ? "Delete" : "Sil"}
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
        </div>
      )}

      {/* ── İÇE AKTARMA GEÇMİŞİ ── */}
      {tab === "history" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", fontWeight: 700, fontSize: "14px" }}>
            {lang === "en" ? "Import History" : "İçe Aktarma Geçmişi"}
          </div>
          {batchesLoading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /></div>
          ) : batches.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--color-text-muted)" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>🕒</div>
              <p style={{ fontSize: "16px", fontWeight: 600 }}>{lang === "en" ? "No Import History Yet" : "Henüz İçe Aktarma Geçmişi Yok"}</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th>{lang === "en" ? "Import Date" : "Yükleme Tarihi"}</th>
                    <th>{lang === "en" ? "Date Range" : "Tarih Aralığı"}</th>
                    <th>{lang === "en" ? "Record Count" : "Kayıt Sayısı"}</th>
                    <th>{lang === "en" ? "Total Revenue" : "Toplam Ciro"}</th>
                    <th style={{ textAlign: "right" }}>{lang === "en" ? "Actions" : "İşlem"}</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map(b => (
                    <tr key={b.importBatchId ?? "_none_"}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {b.importBatchId === null
                          ? (lang === "en" ? "Legacy records without import info" : "Toplu içe aktarma bilgisi olmayan eski kayıtlar")
                          : (b.importDate ? format(new Date(b.importDate), "dd MMM yyyy HH:mm", { locale: lang === "en" ? enUS : tr }) : "—")}
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontSize: "12px", color: "var(--color-text-muted)" }}>
                        {b.dateRangeStart && b.dateRangeEnd
                          ? `${format(parseDateOnlyLocal(b.dateRangeStart), "dd MMM yyyy", { locale: lang === "en" ? enUS : tr })} – ${format(parseDateOnlyLocal(b.dateRangeEnd), "dd MMM yyyy", { locale: lang === "en" ? enUS : tr })}`
                          : "—"}
                      </td>
                      <td>{b.recordCount.toLocaleString("tr-TR")}</td>
                      <td style={{ fontWeight: 700 }}>{fmt(b.totalRevenue)}</td>
                      <td style={{ textAlign: "right" }}>
                        <button onClick={() => setBatchDeleteTarget(b)}
                          style={{ padding: "3px 8px", fontSize: "11px", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                          {lang === "en" ? "Delete This Import" : "Bu Yüklemeyi Sil"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {overlapCheck && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "480px", padding: "var(--spacing-6)" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px", textAlign: "center" }}>⚠️</div>
            <h3 style={{ fontWeight: 700, marginBottom: "8px", textAlign: "center" }}>
              {lang === "en" ? "Overlapping Date Range Detected" : "Çakışan Tarih Aralığı Tespit Edildi"}
            </h3>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--spacing-3)", fontSize: "14px", lineHeight: 1.5 }}>
              {lang === "en"
                ? <>The file you are about to save covers <strong>{format(parseDateOnlyLocal(overlapCheck.span.start), "dd MMM yyyy", { locale: enUS })} – {format(parseDateOnlyLocal(overlapCheck.span.end), "dd MMM yyyy", { locale: enUS })}</strong>. This range already contains <strong>{overlapCheck.count.toLocaleString("en-US")}</strong> saved record(s) from <strong>{overlapCheck.batchCount}</strong> prior upload{overlapCheck.batchCount === 1 ? "" : "s"}.</>
                : <>Kaydetmek üzere olduğunuz dosya <strong>{format(parseDateOnlyLocal(overlapCheck.span.start), "dd MMM yyyy", { locale: tr })} – {format(parseDateOnlyLocal(overlapCheck.span.end), "dd MMM yyyy", { locale: tr })}</strong> aralığını kapsıyor. Bu aralıkta zaten <strong>{overlapCheck.batchCount}</strong> önceki yüklemeden gelen <strong>{overlapCheck.count.toLocaleString("tr-TR")}</strong> kayıt bulunuyor.</>}
            </p>
            <p style={{ color: "var(--color-warning)", marginBottom: "var(--spacing-5)", fontSize: "13px", fontWeight: 600, lineHeight: 1.5 }}>
              {lang === "en"
                ? "Keeping both sets of records risks double-counting the same sales in every report, chart and AI summary."
                : "İkisini birlikte tutmak, aynı satışların her raporda, grafikte ve yapay zekâ özetinde ÇİFT SAYILMASINA yol açabilir."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
              <button className="btn btn-primary" onClick={() => void handleOverlapDeleteAndSave()} disabled={overlapBusy !== null || saving}>
                {overlapBusy === "delete"
                  ? (lang === "en" ? "Deleting old records..." : "Eski kayıtlar siliniyor...")
                  : (lang === "en" ? "Delete old records in this range, save new file" : "Bu aralıktaki eski kayıtları sil, yeni dosyayı kaydet")}
              </button>
              <button
                className="btn"
                style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)", border: "1px solid var(--color-warning-border)", fontWeight: 600 }}
                onClick={() => void handleOverlapAddAnyway()}
                disabled={overlapBusy !== null || saving}
              >
                {lang === "en" ? "Add anyway (may be double-counted)" : "Yine de ekle (çift sayılabilir)"}
              </button>
              <button className="btn btn-secondary" onClick={handleOverlapCancel} disabled={overlapBusy !== null || saving}>
                {lang === "en" ? "Cancel" : "İptal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {batchDeleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "420px", padding: "var(--spacing-6)", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🗑️</div>
            <h3 style={{ fontWeight: 700, marginBottom: "8px" }}>{lang === "en" ? "Delete This Import" : "Bu Yüklemeyi Sil"}</h3>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--spacing-5)", fontSize: "14px" }}>
              {lang === "en"
                ? `This will delete ${batchDeleteTarget.recordCount.toLocaleString("en-US")} sales records from this import. This action cannot be undone.`
                : `Bu içe aktarmaya ait ${batchDeleteTarget.recordCount.toLocaleString("tr-TR")} satış kaydı silinecek. Bu işlem geri alınamaz.`}
            </p>
            <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setBatchDeleteTarget(null)}>{lang === "en" ? "Cancel" : "İptal"}</button>
              <button className="btn" style={{ flex: 1, background: "var(--color-danger)", color: "white" }}
                onClick={() => void handleDeleteBatch()} disabled={batchDeleting}>
                {batchDeleting ? (lang === "en" ? "Deleting..." : "Siliniyor...") : (lang === "en" ? "Yes, Delete" : "Evet, Sil")}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "380px", padding: "var(--spacing-6)", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🗑️</div>
            <h3 style={{ fontWeight: 700, marginBottom: "8px" }}>{lang === "en" ? "Delete Sales Record" : "Satış Kaydını Sil"}</h3>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--spacing-5)", fontSize: "14px" }}>{lang === "en" ? "Are you sure you want to delete this sales record?" : "Bu satış kaydını silmek istediğinizden emin misiniz?"}</p>
            <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setDeleteId(null)}>{lang === "en" ? "Cancel" : "İptal"}</button>
              <button className="btn" style={{ flex: 1, background: "var(--color-danger)", color: "white" }}
                onClick={() => void handleDelete()} disabled={deleting}>
                {deleting ? (lang === "en" ? "Deleting..." : "Siliniyor...") : (lang === "en" ? "Yes, Delete" : "Evet, Sil")}
              </button>
            </div>
          </div>
        </div>
      )}

      {drillDown && (
        <DrillDownModal
          title={drillDown.title}
          records={drillDown.records}
          lang={lang}
          onClose={() => setDrillDown(null)}
        />
      )}
    </div>
  );
}
