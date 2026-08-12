"use client";

import { useState, useEffect, useRef } from "react";
import { useLangContext } from "@/app/providers/LangProvider";
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
} from "recharts";

import FileUploadWithReview from "@/components/file-upload/FileUploadWithReview";
import {
  parseInventoryRows,
  analyzeInventory,
  detectInventoryColumnMap,
  isAutoMappingConfident,
  truncateLabel,
  topNWithOther,
  type InventoryAnalysis,
  type InventoryRow,
  type InventoryColumnMap,
} from "@/lib/utils/inventory-analysis";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ChartFormatter } from "@/lib/utils/chartTypes";

interface ParsedRow {
  rowIndex: number;
  rawData: Record<string, unknown>;
  isValid: boolean;
  errors?: string[];
}

interface InventoryReportSummary {
  id: string;
  fileName: string;
  totalProducts: number;
  soldProducts: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  createdAt: string;
}

interface InventoryReportFull extends InventoryReportSummary {
  items: InventoryRow[];
}

// Envanter satırı alanlarının Türkçe/İngilizce etiketleri ve kolon eşleştirme
// ekranındaki sıralaması. Gelir/kâr hesaplamalarını doğrudan etkileyen dört alan
// (ad, satış adedi, alış/satış fiyatı) "required" işaretlenir — zorunlu değildir,
// ama boş bırakılırsa kullanıcı uyarılır.
const INVENTORY_FIELDS: Array<{ key: keyof InventoryRow; tr: string; en: string; required?: boolean; hintTr: string; hintEn: string }> = [
  { key: "name", tr: "Ürün Adı", en: "Product Name", required: true,
    hintTr: "Ürünün adı veya açıklaması. Örn: \"PAROL 500 MG 20 TB\"",
    hintEn: "The product's name or description. E.g. \"PAROL 500 MG 20 TB\"" },
  { key: "barcode", tr: "Barkod", en: "Barcode",
    hintTr: "Ürün/ilaç kodu veya barkod numarası.",
    hintEn: "Product/drug code or barcode number." },
  { key: "category", tr: "Kategori", en: "Category",
    hintTr: "Ürün grubu (İlaç, OTC, Dermokozmetik vb.)",
    hintEn: "Product group (Drug, OTC, Dermocosmetics, etc.)" },
  { key: "openingStock", tr: "Dönem Başı Stok", en: "Opening Stock",
    hintTr: "Dönem başındaki stok adedi (varsa).",
    hintEn: "Stock quantity at the start of the period (if available)." },
  { key: "purchaseQty", tr: "Alış Adedi", en: "Purchase Quantity",
    hintTr: "Bu dönem içinde satın alınan/girişi yapılan adet.",
    hintEn: "Quantity purchased/received during this period." },
  { key: "salesQty", tr: "Satış Adedi", en: "Sales Quantity",
    hintTr: "Bu dönemde SATILAN ürün adedi — küçük tam sayı (0, 3, 12...). Çoğu stok raporunda bu sütun bulunmaz, boş bırakabilirsiniz; sistem o zaman stok değerine göre analiz yapar.",
    hintEn: "The quantity SOLD in this period — a small whole number (0, 3, 12...). Most stock reports don't have this column — leave it blank and the system will analyze by stock value instead." },
  { key: "closingStock", tr: "Dönem Sonu Stok", en: "Closing Stock",
    hintTr: "Dönem sonunda elde kalan stok adedi.",
    hintEn: "Remaining stock quantity at the end of the period." },
  { key: "purchasePrice", tr: "Alış Fiyatı", en: "Purchase Price", required: true,
    hintTr: "Ürünün BİRİM alış/maliyet fiyatı (₺) — toplam tutar değil, tek ürünün fiyatı. Örn: 12,50",
    hintEn: "The UNIT purchase/cost price (₺) — not a total amount, the price of one unit. E.g. 12.50" },
  { key: "salePrice", tr: "Satış Fiyatı", en: "Sale Price", required: true,
    hintTr: "Ürünün BİRİM satış fiyatı (₺) — toplam tutar değil, tek ürünün fiyatı. Örn: 45,90",
    hintEn: "The UNIT sale price (₺) — not a total amount, the price of one unit. E.g. 45.90" },
];

const CHART_COLORS = ["#4e7c3f", "#6aaa58", "#9ec97a", "#f5a623", "#e74c3c", "#3498db", "#9b59b6", "#1abc9c"];
const PIE_COLORS = ["#4e7c3f", "#e74c3c"];

function SummaryCard({ label, value, sub, accent }: {
  label: string;
  value: string;
  sub?: string;
  accent?: "success" | "danger" | "primary";
}) {
  const colorMap = {
    success: "var(--color-success)",
    danger: "var(--color-danger)",
    primary: "var(--color-primary-light)",
  };
  const color = accent ? colorMap[accent] : "var(--color-text)";
  return (
    <div style={{
      background: "var(--color-surface)",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border)",
      padding: "var(--spacing-6)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--spacing-1)",
    }}>
      <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{sub}</p>}
    </div>
  );
}

function TopSellersChart({ data, lang, onProductClick }: { data: InventoryRow[]; lang: string; onProductClick?: (name: string) => void }) {
  const en = lang === "en";
  // Satış adedi (birim) ve gelir (₺) çok farklı büyüklük mertebelerinde olduğundan
  // aynı doğrusal eksende gösterilirse gelir çubukları adet çubuklarını görünmez kılar.
  // Bu yüzden tek bir "adet" ekseni kullanılır; gelir bilgisi tooltip'te ayrıca gösterilir.
  const chartData = data.map((r) => ({
    name: truncateLabel(r.name, 20),
    fullName: r.name,
    adet: r.salesQty,
    gelir: r.salesQty * r.salePrice,
  }));

  return (
    <div style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 32, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => v.toLocaleString("tr-TR")} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "var(--color-text)" }} />
          <Tooltip
            formatter={((_value: string | number | undefined, _name: string | number | undefined, item: { payload?: { adet: number; gelir: number } }) => {
              const p = item?.payload;
              return [
                `${(p?.adet ?? 0).toLocaleString("tr-TR")} ${en ? "units" : "adet"} · ${formatCurrency(p?.gelir ?? 0)}`,
                en ? "Sales" : "Satış",
              ];
            }) as ChartFormatter}
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend formatter={() => (en ? "Units Sold (revenue shown on hover)" : "Satış Adedi (gelir üzerine gelince görünür)")} />
          <Bar
            dataKey="adet"
            fill={CHART_COLORS[0]}
            radius={[0, 4, 4, 0]}
            cursor={onProductClick ? "pointer" : undefined}
            onClick={(entry: { payload?: { fullName?: string } }) => {
              if (onProductClick && entry?.payload?.fullName) onProductClick(entry.payload.fullName);
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SoldUnsoldPieChart({ sold, unsold, lang }: { sold: number; unsold: number; lang: string }) {
  const en = lang === "en";
  const data = [
    { name: en ? "Sold Products" : "Satılan Ürünler", value: sold },
    { name: en ? "Unsold Products" : "Satılmayan Ürünler", value: unsold },
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
          >
            {data.map((_entry, i) => (
              <Cell key={i} fill={PIE_COLORS[i]} />
            ))}
          </Pie>
          <Tooltip
            formatter={((value: string | number | undefined) => [Number(value ?? 0).toLocaleString("tr-TR") + (en ? " products" : " ürün")]) as ChartFormatter}
            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProfitChart({ data, lang, onProductClick }: { data: Array<{ name: string; profit: number; margin: number }>; lang: string; onProductClick?: (name: string) => void }) {
  const en = lang === "en";
  const chartData = data.map((r) => ({
    name: truncateLabel(r.name, 16),
    fullName: r.name,
    kar: Math.round(r.profit * 100) / 100,
    marj: Math.round(r.margin * 10) / 10,
  }));

  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 48, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => formatCurrency(v)} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "var(--color-text)" }} />
          <Tooltip
            formatter={((value: string | number | undefined, name?: string | number) => {
              const v = Number(value ?? 0);
              return String(name) === "kar"
                ? [formatCurrency(v), en ? "Profit" : "Kâr"]
                : [v + "%", en ? "Profit Margin" : "Kâr Marjı"];
            }) as ChartFormatter}
            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
          />
          <Bar
            dataKey="kar"
            fill={CHART_COLORS[1]}
            radius={[0, 4, 4, 0]}
            cursor={onProductClick ? "pointer" : undefined}
            onClick={(entry: { payload?: { fullName?: string } }) => {
              if (onProductClick && entry?.payload?.fullName) onProductClick(entry.payload.fullName);
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Satış adedi bilgisi olmayan (stok değerleme) dosyalar için: elde mevcut
// stoğun satış fiyatı üzerinden en değerli 10 ürünü.
function StockValueChart({ data, lang, onProductClick }: { data: Array<{ name: string; stockValue: number; closingStock: number }>; lang: string; onProductClick?: (name: string) => void }) {
  const en = lang === "en";
  const chartData = data.map((r) => ({
    name: truncateLabel(r.name, 20),
    fullName: r.name,
    deger: Math.round(r.stockValue * 100) / 100,
    adet: r.closingStock,
  }));

  return (
    <div style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 32, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => formatCurrency(v)} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "var(--color-text)" }} />
          <Tooltip
            formatter={((_value: string | number | undefined, _name: string | number | undefined, item: { payload?: { deger: number; adet: number } }) => {
              const p = item?.payload;
              return [
                `${formatCurrency(p?.deger ?? 0)} (${(p?.adet ?? 0).toLocaleString("tr-TR")} ${en ? "units in stock" : "adet stokta"})`,
                en ? "Stock Value" : "Stok Değeri",
              ];
            }) as ChartFormatter}
            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
          />
          <Bar
            dataKey="deger"
            fill={CHART_COLORS[0]}
            radius={[0, 4, 4, 0]}
            cursor={onProductClick ? "pointer" : undefined}
            onClick={(entry: { payload?: { fullName?: string } }) => {
              if (onProductClick && entry?.payload?.fullName) onProductClick(entry.payload.fullName);
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Kategori bazında stok değeri dağılımı — dilim sayısı çok fazlaysa (ör. "Tanımsız"
// gibi bir grup baskınsa) okunaklı kalması için ilk 6 kategori + "Diğer" gösterilir.
function CategoryValuePieChart({ data, lang, onCategoryClick }: { data: Array<{ category: string; value: number }>; lang: string; onCategoryClick?: (category: string, isOther: boolean, otherCategories: string[]) => void }) {
  const en = lang === "en";
  const positive = data.filter((d) => d.value > 0);
  const { top, otherLabels, otherSum } = topNWithOther(positive, "category", "value", 6);
  const otherLabel = en ? "Other" : "Diğer";
  // "category" alanı tıklama/filtreleme için orijinal ismi korur; "label" alanı
  // yalnızca legend/eksende gösterilen kısaltılmış metindir.
  const chartData = otherSum > 0
    ? [...top.map((t) => ({ category: t.category, label: truncateLabel(t.category, 18), value: t.value })), { category: otherLabel, label: otherLabel, value: otherSum }]
    : top.map((t) => ({ category: t.category, label: truncateLabel(t.category, 18), value: t.value }));
  const restSum = otherSum;
  const otherCategories = otherLabels;

  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={3}
            dataKey="value"
            nameKey="label"
            cursor={onCategoryClick ? "pointer" : undefined}
            onClick={(entry: { payload?: { category?: string } }) => {
              const category = entry?.payload?.category;
              if (!onCategoryClick || !category) return;
              const isOther = category === (en ? "Other" : "Diğer") && restSum > 0;
              onCategoryClick(category, isOther, otherCategories);
            }}
          >
            {chartData.map((_entry, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={((value: string | number | undefined) => [formatCurrency(Number(value ?? 0)), en ? "Stock Value" : "Stok Değeri"]) as ChartFormatter}
            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
          />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Kalan stok adedine göre ürünleri kovalara ayırır — çok sayıda 0 stoklu ürün ölü stoğa işaret eder.
const STOCK_BUCKETS: Array<{ label: string; test: (qty: number) => boolean }> = [
  { label: "0", test: (q) => q === 0 },
  { label: "1-5", test: (q) => q >= 1 && q <= 5 },
  { label: "6-20", test: (q) => q >= 6 && q <= 20 },
  { label: "21-50", test: (q) => q >= 21 && q <= 50 },
  { label: "50+", test: (q) => q > 50 },
];

function StockLevelChart({ data, lang, onBucketClick }: { data: InventoryRow[]; lang: string; onBucketClick?: (label: string) => void }) {
  const chartData = STOCK_BUCKETS.map((b) => ({
    label: b.label,
    count: data.filter((r) => b.test(r.closingStock)).length,
  }));

  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-text)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} allowDecimals={false} />
          <Tooltip
            formatter={((value: string | number | undefined) => [Number(value ?? 0).toLocaleString("tr-TR") + (lang === "en" ? " products" : " ürün"), lang === "en" ? "Product Count" : "Ürün Sayısı"]) as ChartFormatter}
            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
          />
          <Bar
            dataKey="count"
            fill={CHART_COLORS[3]}
            radius={[4, 4, 0, 0]}
            cursor={onBucketClick ? "pointer" : undefined}
            onClick={(entry: { payload?: { label?: string } }) => {
              if (onBucketClick && entry?.payload?.label) onBucketClick(entry.payload.label);
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Kâr marjı (%) aralıklarına göre ürün sayısı — hangi marj bandının en yoğun olduğunu gösterir.
const MARGIN_BUCKETS: Array<{ label: string; test: (m: number) => boolean }> = [
  { label: "<0%", test: (m) => m < 0 },
  { label: "0-10%", test: (m) => m >= 0 && m < 10 },
  { label: "10-25%", test: (m) => m >= 10 && m < 25 },
  { label: "25-50%", test: (m) => m >= 25 && m < 50 },
  { label: "50%+", test: (m) => m >= 50 },
];

function MarginDistributionChart({ data, lang, onBucketClick }: { data: InventoryRow[]; lang: string; onBucketClick?: (label: string) => void }) {
  const withMargin = data
    .filter((r) => r.salePrice > 0 && r.purchasePrice > 0)
    .map((r) => ({ row: r, margin: ((r.salePrice - r.purchasePrice) / r.salePrice) * 100 }));
  const chartData = MARGIN_BUCKETS.map((b) => ({
    label: b.label,
    count: withMargin.filter((r) => b.test(r.margin)).length,
  }));

  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-text)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} allowDecimals={false} />
          <Tooltip
            formatter={((value: string | number | undefined) => [Number(value ?? 0).toLocaleString("tr-TR") + (lang === "en" ? " products" : " ürün"), lang === "en" ? "Product Count" : "Ürün Sayısı"]) as ChartFormatter}
            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
          />
          <Bar
            dataKey="count"
            fill={CHART_COLORS[5]}
            radius={[4, 4, 0, 0]}
            cursor={onBucketClick ? "pointer" : undefined}
            onClick={(entry: { payload?: { label?: string } }) => {
              if (onBucketClick && entry?.payload?.label) onBucketClick(entry.payload.label);
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProductDetailModal({ title, rows, lang, onClose }: { title: string; rows: InventoryRow[]; lang: string; onClose: () => void }) {
  const en = lang === "en";
  const shown = rows.slice(0, 200);
  const extra = rows.length - shown.length;
  const totalStockValue = rows.reduce((s, r) => s + r.closingStock * r.salePrice, 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
      <div className="card" style={{ width: "min(900px, 100%)", maxHeight: "85vh", display: "flex", flexDirection: "column", padding: "var(--spacing-6)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--spacing-4)" }}>
          <h3 style={{ fontWeight: 700, fontSize: "var(--font-size-base)" }}>{title} — {rows.length} {en ? "products" : "ürün"}</h3>
          <button className="btn btn-secondary" onClick={onClose}>{en ? "Close" : "Kapat"}</button>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          <table className="table" aria-label={en ? "Product Detail Table" : "Ürün Detay Tablosu"}>
            <thead>
              <tr>
                <th scope="col">{en ? "Product Name" : "Ürün Adı"}</th>
                <th scope="col">{en ? "Barcode" : "Barkod"}</th>
                <th scope="col">{en ? "Category" : "Kategori"}</th>
                <th scope="col">{en ? "Remaining Stock" : "Kalan Stok"}</th>
                <th scope="col">{en ? "Purchase Price" : "Alış Fiyatı"}</th>
                <th scope="col">{en ? "Sale Price" : "Satış Fiyatı"}</th>
                <th scope="col">{en ? "Stock Value" : "Stok Değeri"}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{row.name}</td>
                  <td style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{row.barcode || "—"}</td>
                  <td><span className="badge badge-info">{row.category}</span></td>
                  <td>{row.closingStock.toLocaleString("tr-TR")}</td>
                  <td>{row.purchasePrice > 0 ? formatCurrency(row.purchasePrice) : "—"}</td>
                  <td>{row.salePrice > 0 ? formatCurrency(row.salePrice) : "—"}</td>
                  <td style={{ fontWeight: 600 }}>
                    {row.purchasePrice > 0 || row.salePrice > 0
                      ? formatCurrency(row.closingStock * row.salePrice)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {extra > 0 && (
            <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "var(--spacing-2)", textAlign: "center" }}>
              +{extra} {en ? "more rows" : "satır daha"}
            </p>
          )}
        </div>
        <div style={{ marginTop: "var(--spacing-4)", paddingTop: "var(--spacing-3)", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "flex-end", fontSize: "14px" }}>
          <span style={{ color: "var(--color-text-muted)", marginRight: "8px" }}>{en ? "Total Stock Value:" : "Toplam Stok Değeri:"}</span>
          <span style={{ fontWeight: 700 }}>{formatCurrency(totalStockValue)}</span>
        </div>
      </div>
    </div>
  );
}

function AnalysisDashboard({ analysis, inventoryRows, lang }: {
  analysis: InventoryAnalysis;
  inventoryRows: InventoryRow[];
  lang: string;
}) {
  const en = lang === "en";
  const { summary, hasSalesData } = analysis;
  const categoryValueData = analysis.categoryBreakdown.map((c) => ({ category: c.category, value: hasSalesData ? c.revenue : c.stockValue }));

  // Kategori sayısı fazlaysa (ör. 15+ ürün grubu) x-ekseni okunaksız hale gelir —
  // birincil metriğe (gelir/stok değeri) göre en büyük 8 kategori gösterilir,
  // kalanı "Diğer" altında toplanır. Etiketler ayrıca kısaltılır.
  const categoryChartRaw = hasSalesData
    ? analysis.categoryBreakdown.map((c) => ({ category: c.category, revenue: c.revenue, profit: c.profit }))
    : analysis.categoryBreakdown.map((c) => ({ category: c.category, revenue: c.stockValue, profit: c.stockCost }));
  const CATEGORY_CHART_LIMIT = 8;
  const categoryChartSorted = [...categoryChartRaw].sort((a, b) => b.revenue - a.revenue);
  const categoryChartTop = categoryChartSorted.slice(0, CATEGORY_CHART_LIMIT);
  const categoryChartRest = categoryChartSorted.slice(CATEGORY_CHART_LIMIT);
  const categoryChartData = [
    ...categoryChartTop.map((c) => ({ category: c.category, label: truncateLabel(c.category, 14), revenue: c.revenue, profit: c.profit })),
    ...(categoryChartRest.length > 0
      ? [{
          category: en ? "Other" : "Diğer",
          label: en ? "Other" : "Diğer",
          revenue: categoryChartRest.reduce((s, c) => s + c.revenue, 0),
          profit: categoryChartRest.reduce((s, c) => s + c.profit, 0),
        }]
      : []),
  ];

  const [detail, setDetail] = useState<{ title: string; rows: InventoryRow[] } | null>(null);

  const handleProductClick = (name: string): void => {
    const rows = inventoryRows.filter((r) => r.name === name);
    setDetail({ title: name, rows });
  };

  const handleCategoryClick = (category: string, isOther: boolean, otherCategories: string[]): void => {
    const rows = isOther
      ? inventoryRows.filter((r) => otherCategories.includes(r.category || "Genel"))
      : inventoryRows.filter((r) => (r.category || "Genel") === category);
    setDetail({ title: category, rows });
  };

  const handleStockBucketClick = (label: string): void => {
    const bucket = STOCK_BUCKETS.find((b) => b.label === label);
    const rows = bucket ? inventoryRows.filter((r) => bucket.test(r.closingStock)) : [];
    const title = en ? `Stock Level: ${label}` : `Stok Seviyesi: ${label}`;
    setDetail({ title, rows });
  };

  const handleMarginBucketClick = (label: string): void => {
    const bucket = MARGIN_BUCKETS.find((b) => b.label === label);
    const rows = bucket
      ? inventoryRows.filter((r) => {
          if (!(r.salePrice > 0 && r.purchasePrice > 0)) return false;
          const margin = ((r.salePrice - r.purchasePrice) / r.salePrice) * 100;
          return bucket.test(margin);
        })
      : [];
    const title = en ? `Profit Margin: ${label}` : `Kâr Marjı: ${label}`;
    setDetail({ title, rows });
  };

  const rowsWithMargin = inventoryRows.filter((r) => r.salePrice > 0 && r.purchasePrice > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-8)" }}>
      {!hasSalesData && (
        <div style={{
          padding: "12px 16px", background: "var(--color-primary-pale)", border: "1px solid var(--color-primary-light)",
          borderRadius: "var(--radius-md)", fontSize: "13px", color: "var(--color-text)", display: "flex", gap: "10px", alignItems: "flex-start",
        }}>
          <span style={{ fontSize: "18px", flexShrink: 0 }}>ℹ️</span>
          <span>
            {en
              ? "This file has no sales-quantity column — it's a stock valuation report. The figures below show the value of your CURRENT stock, not sales performance."
              : "Bu dosyada satış adedi sütunu yok — bir stok değerleme raporu. Aşağıdaki rakamlar satış performansını değil, ELİNİZDEKİ MEVCUT STOĞUN değerini gösterir."}
          </span>
        </div>
      )}

      <section>
        <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
          {en ? "Inventory Summary" : "Envanter Özeti"}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--spacing-4)" }}>
          <SummaryCard label={en ? "Total Products" : "Toplam Ürün"} value={summary.totalProducts.toLocaleString("tr-TR")} />
          {hasSalesData ? (
            <>
              <SummaryCard
                label={en ? "Sold Products" : "Satılan Ürün"}
                value={summary.soldProducts.toLocaleString("tr-TR")}
                sub={`${Math.round((summary.soldProducts / summary.totalProducts) * 100)}% ${en ? "sell rate" : "satış oranı"}`}
                accent="success"
              />
              <SummaryCard
                label={en ? "Unsold Products" : "Satılmayan Ürün"}
                value={summary.unsoldProducts.toLocaleString("tr-TR")}
                accent="danger"
              />
              <SummaryCard label={en ? "Total Revenue" : "Toplam Gelir"} value={formatCurrency(summary.totalRevenue)} accent="primary" />
              <SummaryCard
                label={en ? "Net Profit" : "Net Kâr"}
                value={formatCurrency(summary.totalProfit)}
                sub={`${summary.profitMargin.toFixed(1)}% ${en ? "profit margin" : "kâr marjı"}`}
                accent={summary.totalProfit >= 0 ? "success" : "danger"}
              />
            </>
          ) : (
            <>
              <SummaryCard label={en ? "Total Stock Value" : "Toplam Stok Değeri"} value={formatCurrency(summary.totalStockValue)} accent="primary" />
              <SummaryCard label={en ? "Total Stock Cost" : "Toplam Stok Maliyeti"} value={formatCurrency(summary.totalStockCost)} />
              <SummaryCard
                label={en ? "Potential Profit" : "Potansiyel Kâr"}
                value={formatCurrency(summary.potentialProfit)}
                sub={`${summary.potentialMargin.toFixed(1)}% ${en ? "potential margin" : "potansiyel marj"}`}
                accent={summary.potentialProfit >= 0 ? "success" : "danger"}
              />
            </>
          )}
          <SummaryCard
            label={en ? "Profitable Products" : "Kârlı Ürün"}
            value={`${summary.profitableCount} / ${summary.totalProducts}`}
            sub={`${summary.unprofitableCount} ${en ? "unprofitable products" : "kârsız ürün"}`}
          />
        </div>
      </section>

      <div className="responsive-grid responsive-grid-2-1" style={{ gap: "var(--spacing-6)" }}>
        <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
          <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
            {hasSalesData ? (en ? "Top 10 Best-Selling Products" : "En Çok Satan 10 Ürün") : (en ? "Top 10 Products by Stock Value" : "Stok Değerine Göre En Değerli 10 Ürün")}
          </h3>
          {hasSalesData
            ? (analysis.topSellers.length > 0
                ? <TopSellersChart data={analysis.topSellers} lang={lang} onProductClick={handleProductClick} />
                : <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "40px" }}>{en ? "No sales data found" : "Satış verisi bulunamadı"}</p>)
            : (analysis.topByStockValue.length > 0
                ? <StockValueChart data={analysis.topByStockValue} lang={lang} onProductClick={handleProductClick} />
                : <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "40px" }}>{en ? "No stock value data found" : "Stok değeri verisi bulunamadı"}</p>)
          }
        </section>

        <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
          <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
            {hasSalesData ? (en ? "Sales Distribution" : "Satış Dağılımı") : (en ? "Stock Value by Category" : "Kategori Bazında Stok Değeri")}
          </h3>
          {hasSalesData
            ? <SoldUnsoldPieChart sold={summary.soldProducts} unsold={summary.unsoldProducts} lang={lang} />
            : <CategoryValuePieChart data={categoryValueData} lang={lang} onCategoryClick={handleCategoryClick} />
          }
        </section>
      </div>

      {analysis.profitByProduct.length > 0 && (
        <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
          <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
            {hasSalesData ? (en ? "Top 10 Most Profitable Products" : "En Kârlı 10 Ürün") : (en ? "Top 10 Highest Potential Profit" : "En Yüksek Potansiyel Kârlı 10 Ürün")}
          </h3>
          <ProfitChart data={analysis.profitByProduct} lang={lang} onProductClick={handleProductClick} />
        </section>
      )}

      {analysis.categoryBreakdown.length > 1 && (
        <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
          <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
            {hasSalesData ? (en ? "Revenue by Category" : "Kategori Bazında Gelir") : (en ? "Stock Value & Cost by Category" : "Kategori Bazında Stok Değeri ve Maliyeti")}
          </h3>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ left: 8, right: 16, top: 8, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-text)" }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => formatCurrency(v)} />
                <Tooltip
                  formatter={((value: string | number | undefined, name?: string | number) => {
                    const v = Number(value ?? 0);
                    if (hasSalesData) return String(name) === "revenue" ? [formatCurrency(v), en ? "Revenue" : "Gelir"] : [formatCurrency(v), en ? "Profit" : "Kâr"];
                    return String(name) === "revenue" ? [formatCurrency(v), en ? "Stock Value" : "Stok Değeri"] : [formatCurrency(v), en ? "Stock Cost" : "Stok Maliyeti"];
                  }) as ChartFormatter}
                  contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
                />
                <Legend formatter={(v) => {
                  if (hasSalesData) return v === "revenue" ? (en ? "Revenue" : "Gelir") : (en ? "Profit" : "Kâr");
                  return v === "revenue" ? (en ? "Stock Value" : "Stok Değeri") : (en ? "Stock Cost" : "Stok Maliyeti");
                }} />
                <Bar
                  dataKey="revenue"
                  fill={CHART_COLORS[0]}
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(entry: { payload?: { category?: string } }) => {
                    if (entry?.payload?.category) handleCategoryClick(entry.payload.category, false, []);
                  }}
                />
                <Bar
                  dataKey="profit"
                  fill={CHART_COLORS[2]}
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(entry: { payload?: { category?: string } }) => {
                    if (entry?.payload?.category) handleCategoryClick(entry.payload.category, false, []);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--spacing-6)" }}>
        <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
          <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
            {en ? "Stock Level Distribution" : "Stok Seviyesi Dağılımı"}
          </h3>
          {inventoryRows.length > 0
            ? <StockLevelChart data={inventoryRows} lang={lang} onBucketClick={handleStockBucketClick} />
            : <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "40px" }}>{en ? "No stock data found" : "Stok verisi bulunamadı"}</p>}
        </section>

        <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
          <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
            {en ? "Profit Margin Distribution" : "Kâr Marjı Dağılımı"}
          </h3>
          {rowsWithMargin.length > 0
            ? <MarginDistributionChart data={inventoryRows} lang={lang} onBucketClick={handleMarginBucketClick} />
            : <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "40px" }}>{en ? "Not enough price data to calculate profit margins" : "Kâr marjı hesaplamak için yeterli fiyat verisi yok"}</p>}
        </section>
      </div>

      {hasSalesData && analysis.unsoldProducts.length > 0 && (
        <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--spacing-4)" }}>
            <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700 }}>
              {en ? "Unsold Products" : "Satılmayan Ürünler"}
            </h3>
            <span className="badge badge-danger">{analysis.unsoldProducts.length} {en ? "Products" : "Ürün"}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table" aria-label={en ? "Unsold Products Table" : "Satılmayan Ürünler Tablosu"}>
              <thead>
                <tr>
                  <th scope="col">{en ? "Product Name" : "Ürün Adı"}</th>
                  <th scope="col">{en ? "Barcode" : "Barkod"}</th>
                  <th scope="col">{en ? "Category" : "Kategori"}</th>
                  <th scope="col">{en ? "Current Stock" : "Mevcut Stok"}</th>
                  <th scope="col">{en ? "Purchase Price" : "Alış Fiyatı"}</th>
                  <th scope="col">{en ? "Sale Price" : "Satış Fiyatı"}</th>
                  <th scope="col">{en ? "Stock Value" : "Stok Değeri"}</th>
                </tr>
              </thead>
              <tbody>
                {analysis.unsoldProducts.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{row.name}</td>
                    <td style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{row.barcode || "—"}</td>
                    <td><span className="badge badge-info">{row.category}</span></td>
                    <td>{row.closingStock.toLocaleString("tr-TR")}</td>
                    <td>{row.purchasePrice > 0 ? formatCurrency(row.purchasePrice) : "—"}</td>
                    <td>{row.salePrice > 0 ? formatCurrency(row.salePrice) : "—"}</td>
                    <td style={{ fontWeight: 600 }}>
                      {row.purchasePrice > 0
                        ? formatCurrency(row.closingStock * row.purchasePrice)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <details style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" }}>
        <summary style={{ padding: "var(--spacing-4) var(--spacing-6)", cursor: "pointer", fontWeight: 600, userSelect: "none" }}>
          {en ? `All Product Data (${inventoryRows.length} rows)` : `Tüm Ürün Verileri (${inventoryRows.length} satır)`}
        </summary>
        <div style={{ padding: "0 var(--spacing-6) var(--spacing-6)", overflowX: "auto" }}>
          <table className="table" aria-label={en ? "All Product Data" : "Tüm Ürün Verileri"}>
            <thead>
              <tr>
                <th scope="col">{en ? "Product Name" : "Ürün Adı"}</th>
                <th scope="col">{en ? "Barcode" : "Barkod"}</th>
                {hasSalesData && <th scope="col">{en ? "Units Sold" : "Satış Adedi"}</th>}
                <th scope="col">{en ? "Remaining Stock" : "Kalan Stok"}</th>
                <th scope="col">{en ? "Purchase Price" : "Alış Fiyatı"}</th>
                <th scope="col">{en ? "Sale Price" : "Satış Fiyatı"}</th>
                {hasSalesData ? (
                  <>
                    <th scope="col">{en ? "Profit/Unit" : "Kâr/Ürün"}</th>
                    <th scope="col">{en ? "Total Profit" : "Toplam Kâr"}</th>
                  </>
                ) : (
                  <th scope="col">{en ? "Stock Value" : "Stok Değeri"}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {inventoryRows.map((row, i) => {
                const unitProfit = row.salePrice - row.purchasePrice;
                const totalProfit = row.salesQty * unitProfit;
                const stockValue = row.closingStock * row.salePrice;
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{row.name}</td>
                    <td style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{row.barcode || "—"}</td>
                    {hasSalesData && (
                      <td>
                        <span style={{ fontWeight: 600, color: row.salesQty > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}>
                          {row.salesQty.toLocaleString("tr-TR")}
                        </span>
                      </td>
                    )}
                    <td>{row.closingStock.toLocaleString("tr-TR")}</td>
                    <td>{row.purchasePrice > 0 ? formatCurrency(row.purchasePrice) : "—"}</td>
                    <td>{row.salePrice > 0 ? formatCurrency(row.salePrice) : "—"}</td>
                    {hasSalesData ? (
                      <>
                        <td style={{ color: unitProfit >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                          {row.salePrice > 0 && row.purchasePrice > 0 ? formatCurrency(unitProfit) : "—"}
                        </td>
                        <td style={{ fontWeight: 600, color: totalProfit >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                          {row.salesQty > 0 && row.salePrice > 0 && row.purchasePrice > 0
                            ? formatCurrency(totalProfit)
                            : "—"}
                        </td>
                      </>
                    ) : (
                      <td style={{ fontWeight: 600 }}>
                        {stockValue > 0 ? formatCurrency(stockValue) : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>

      {detail && <ProductDetailModal title={detail.title} rows={detail.rows} lang={lang} onClose={() => setDetail(null)} />}
    </div>
  );
}

// Son yükleme özeti — "Geçmiş Raporlar" sekmesine girmeden en son içe aktarılan
// dosyanın tarihini/ürün sayısını/gelirini bir bakışta gösterir.
function LastUploadBanner({ report, loaded, en }: {
  report: InventoryReportSummary | null;
  loaded: boolean;
  en: boolean;
}) {
  if (!loaded || !report) return null;
  return (
    <div style={{
      marginBottom: "var(--spacing-5)", padding: "12px 16px", background: "var(--color-primary-pale)",
      border: "1px solid var(--color-primary-light)", borderRadius: "var(--radius-md)", fontSize: "13px",
      color: "var(--color-text)", display: "flex", gap: "10px", alignItems: "flex-start",
    }}>
      <span style={{ fontSize: "16px", flexShrink: 0 }}>📦</span>
      <span>
        <strong>{en ? "Last Upload: " : "Son Yükleme: "}</strong>
        {formatDate(report.createdAt, true)}
        {" · "}
        {report.totalProducts.toLocaleString("tr-TR")} {en ? "products" : "ürün"}
        {" · "}
        {formatCurrency(Number(report.totalRevenue))} {en ? "revenue" : "gelir"}
        {" · "}
        <span style={{ color: "var(--color-text-muted)" }}>{report.fileName}</span>
      </span>
    </div>
  );
}

function ViewTabs({ viewMode, onSelect, en }: {
  viewMode: "new" | "history";
  onSelect: (mode: "new" | "history") => void;
  en: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "var(--spacing-6)" }}>
      {(["new", "history"] as const).map((v) => (
        <button
          key={v}
          className="btn"
          onClick={() => onSelect(v)}
          style={{
            background: viewMode === v ? "var(--color-primary)" : "var(--color-surface)",
            color: viewMode === v ? "white" : "var(--color-text)",
            border: "1px solid var(--color-border)",
            fontWeight: 600,
            fontSize: "13px",
          }}
        >
          {v === "new" ? (en ? "New Analysis" : "Yeni Analiz") : (en ? "Report History" : "Geçmiş Raporlar")}
        </button>
      ))}
    </div>
  );
}

export default function EnvanterPage() {
  const { lang } = useLangContext();
  const en = lang === "en";

  const [viewMode, setViewMode] = useState<"new" | "history">("new");
  const [phase, setPhase] = useState<"upload" | "mapping" | "analysis">("upload");
  const [mappingData, setMappingData] = useState<{ headers: string[]; rows: ParsedRow[] } | null>(null);
  const [columnOverride, setColumnOverride] = useState<Partial<InventoryColumnMap>>({});
  const [analysis, setAnalysis] = useState<InventoryAnalysis | null>(null);
  const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>([]);
  const [fileName, setFileName] = useState<string>("");

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string>("");

  const [historyList, setHistoryList] = useState<InventoryReportSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<InventoryReportSummary | null>(null);
  const [deletingReport, setDeletingReport] = useState(false);

  // Son yükleme özeti — ana (geçmiş dışı) ekranda öne çıkan, küçük bir kart olarak
  // gösterilir; kullanıcı ayrı "Geçmiş Raporlar" sekmesine girmek zorunda kalmaz.
  const [lastReport, setLastReport] = useState<InventoryReportSummary | null>(null);
  const [lastReportLoaded, setLastReportLoaded] = useState(false);

  // `phase`'in en güncel değerini, effect'in mount anındaki (stale olabilecek)
  // closure'ından bağımsız okuyabilmek için ayna (mirror) bir ref. Otomatik
  // yükleme yalnızca kullanıcı henüz bir işlem başlatmamışsa (hâlâ "upload"
  // aşamasındaysa) tetiklenmeli — bu ref, o kontrolü güvenilir kılar.
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  // Otomatik yükleme yalnızca sayfa ömrü boyunca BİR KEZ denenir (lang
  // değişimiyle effect yeniden çalışsa bile tekrar tetiklenmemesi için).
  const autoLoadAttemptedRef = useRef(false);

  const runAnalysis = (headers: string[], rows: ParsedRow[], override: Partial<InventoryColumnMap>): void => {
    const parsed = parseInventoryRows(headers, rows, override);
    const result = analyzeInventory(parsed);
    setInventoryRows(parsed);
    setAnalysis(result);
    setFileName(`${en ? "Inventory Report" : "Envanter Raporu"} - ${new Date().toLocaleDateString("tr-TR")}`);
    setSaveState("idle");
    setSaveMessage("");
    setPhase("analysis");
  };

  // Temel alanlar (ad + fiyat + stok/adet) otomatik ve güvenilir şekilde bulunduysa
  // kullanıcıdan manuel kolon eşleştirmesi istenmez — doğrudan analiz gösterilir.
  // Eşleştirme her zaman "Sütunları Düzenle" ile analiz ekranından tekrar açılabilir.
  const handleConfirm = async (rows: ParsedRow[], headers: string[]): Promise<void> => {
    const validRows = rows.filter((r) => r.isValid);
    const detected = detectInventoryColumnMap(headers);
    setMappingData({ headers, rows: validRows });
    setColumnOverride(detected);
    if (isAutoMappingConfident(detected)) {
      runAnalysis(headers, validRows, detected);
    } else {
      setPhase("mapping");
    }
  };

  const handleCreateAnalysis = (): void => {
    if (!mappingData) return;
    runAnalysis(mappingData.headers, mappingData.rows, columnOverride);
  };

  const handleBackToUpload = (): void => {
    setMappingData(null);
    setColumnOverride({});
    setPhase("upload");
  };

  const handleReset = (): void => {
    setAnalysis(null);
    setInventoryRows([]);
    setMappingData(null);
    setColumnOverride({});
    setFileName("");
    setSaveState("idle");
    setSaveMessage("");
    setPhase("upload");
  };

  const handleSave = async (): Promise<void> => {
    if (!analysis) return;
    setSaveState("saving");
    setSaveMessage("");
    try {
      const res = await fetch("/api/v1/stok/envanter-raporu", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({
          fileName: fileName || (en ? "Inventory Report" : "Envanter Raporu"),
          items: inventoryRows,
          summary: analysis.summary,
        }),
      });
      let data: { success: boolean; data?: { id: string }; error?: string };
      try {
        data = (await res.json()) as { success: boolean; data?: { id: string }; error?: string };
      } catch {
        throw new Error(en ? "Server returned an invalid response. The report may be too large." : "Sunucudan geçersiz bir yanıt alındı. Rapor çok büyük olabilir.");
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? (en ? "Save failed" : "Kaydetme başarısız oldu"));
      }
      setSaveState("saved");
      setSaveMessage(en ? "Report saved successfully." : "Rapor başarıyla kaydedildi.");
    } catch (err) {
      setSaveState("error");
      setSaveMessage(err instanceof Error ? err.message : (en ? "Save failed" : "Kaydetme başarısız oldu"));
    }
  };

  const fetchHistory = async (): Promise<void> => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const res = await fetch("/api/v1/stok/envanter-raporu", { headers: { "Accept-Language": lang } });
      const data = (await res.json()) as { success: boolean; data?: InventoryReportSummary[]; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? (en ? "Failed to load history" : "Geçmiş yüklenemedi"));
      }
      setHistoryList(data.data ?? []);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : (en ? "Failed to load history" : "Geçmiş yüklenemedi"));
    } finally {
      setHistoryLoading(false);
    }
  };

  // Geçmişten bir raporu tam analizi ile yükler — hem kullanıcının "Geçmiş
  // Raporlar" listesinden bir satıra tıklamasında (bkz. handleSelectHistoryReport)
  // HEM DE sayfa ilk açıldığında otomatik olarak (bkz. aşağıdaki mount effect'i)
  // kullanılan tek, paylaşılan yükleme mantığı. `silent` true olduğunda hata
  // durumunda kullanıcıya görünür bir uyarı göstermez — otomatik yükleme
  // sessizce başarısız olursa kullanıcı sadece boş yükleme ekranını görür,
  // bu da zaten fallback davranışın kendisidir.
  const loadHistoryReport = async (id: string, opts?: { silent?: boolean }): Promise<void> => {
    if (!opts?.silent) setHistoryError("");
    try {
      const res = await fetch(`/api/v1/stok/envanter-raporu?id=${id}`, { headers: { "Accept-Language": lang } });
      const data = (await res.json()) as { success: boolean; data?: InventoryReportFull; error?: string };
      if (!res.ok || !data.success || !data.data) {
        throw new Error(data.error ?? (en ? "Report could not be loaded" : "Rapor yüklenemedi"));
      }
      const report = data.data;
      const items = Array.isArray(report.items) ? report.items : [];
      const result = analyzeInventory(items);
      setInventoryRows(items);
      setAnalysis(result);
      setFileName(report.fileName);
      // Geçmişten yüklenen rapor zaten kayıtlı — tekrar kaydedip mükerrer kayıt oluşmasın diye buton kilitlenir.
      setSaveState("saved");
      setSaveMessage("");
      setViewMode("new");
      setPhase("analysis");
    } catch (err) {
      if (!opts?.silent) {
        setHistoryError(err instanceof Error ? err.message : (en ? "Report could not be loaded" : "Rapor yüklenemedi"));
      }
    }
  };

  // Son yükleme özetini sayfa ilk açıldığında bir kez çeker (tam listeyi ayrıca
  // "Geçmiş Raporlar" sekmesi kendi fetchHistory'siyle yükler — burada gereksiz
  // yere tekrar tam liste istemiyoruz, ama API zaten hafif bir özet listesi
  // döndürdüğü için en yeni kaydı almak için aynı endpoint yeterli).
  //
  // Daha önce bu kart yalnızca BİLGİLENDİRME amaçlıydı — boş yükleme ekranı her
  // zaman gösteriliyordu. Kullanıcı isteği: önceden kaydedilmiş bir rapor varsa,
  // sayfa ilk açıldığında doğrudan o raporun TAM analiz görünümü gösterilsin
  // (sanki "Geçmiş Raporlar"dan en yeni raporu seçmiş gibi) — boş yükleme
  // istemi yerine. Bu, kullanıcı henüz açıkça bir işlem BAŞLATMADIYSA
  // (hâlâ "upload" aşamasındaysa) ve otomatik yükleme daha önce denenmediyse
  // yapılır; aksi halde (yeni kullanıcı, hiç rapor yok) mevcut davranış
  // (boş yükleme ekranı) korunur.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/stok/envanter-raporu", { headers: { "Accept-Language": lang } });
        const data = (await res.json()) as { success: boolean; data?: InventoryReportSummary[] };
        if (!cancelled && res.ok && data.success && data.data && data.data.length > 0) {
          setLastReport(data.data[0]);
          if (!autoLoadAttemptedRef.current && phaseRef.current === "upload") {
            autoLoadAttemptedRef.current = true;
            void loadHistoryReport(data.data[0].id, { silent: true });
          }
        }
      } catch { /* silent — sadece bilgilendirme amaçlı bir özet */ }
      finally { if (!cancelled) setLastReportLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteReport = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeletingReport(true);
    try {
      const res = await fetch(`/api/v1/stok/envanter-raporu/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Accept-Language": lang },
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? (en ? "Delete failed" : "Silme başarısız oldu"));
      }
      setDeleteTarget(null);
      await fetchHistory();
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : (en ? "Delete failed" : "Silme başarısız oldu"));
      setDeleteTarget(null);
    } finally {
      setDeletingReport(false);
    }
  };

  const handleSelectTab = (mode: "new" | "history"): void => {
    setViewMode(mode);
    if (mode === "history") void fetchHistory();
  };

  const handleSelectHistoryReport = (id: string): Promise<void> => loadHistoryReport(id);

  if (viewMode === "history") {
    return (
      <main className="page-content">
        <div style={{ marginBottom: "var(--spacing-8)" }}>
          <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "var(--spacing-2)" }}>
            {en ? "Inventory Analysis" : "Envanter Analizi"}
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            {en ? "View your previously saved inventory reports." : "Daha önce kaydedilmiş envanter raporlarınızı görüntüleyin."}
          </p>
        </div>

        <ViewTabs viewMode={viewMode} onSelect={handleSelectTab} en={en} />

        <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
          <h2 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
            {en ? "Report History" : "Geçmiş Raporlar"}
          </h2>

          {historyLoading && (
            <p style={{ color: "var(--color-text-muted)" }}>{en ? "Loading..." : "Yükleniyor..."}</p>
          )}

          {!historyLoading && historyError && (
            <p style={{ color: "var(--color-danger)" }}>⚠ {historyError}</p>
          )}

          {!historyLoading && !historyError && historyList.length === 0 && (
            <p style={{ color: "var(--color-text-muted)" }}>
              {en ? "No saved reports yet." : "Henüz kaydedilmiş rapor yok."}
            </p>
          )}

          {!historyLoading && !historyError && historyList.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="table" aria-label={en ? "Report History Table" : "Geçmiş Raporlar Tablosu"}>
                <thead>
                  <tr>
                    <th scope="col">{en ? "File Name" : "Dosya Adı"}</th>
                    <th scope="col">{en ? "Date" : "Tarih"}</th>
                    <th scope="col">{en ? "Total Revenue" : "Toplam Gelir"}</th>
                    <th scope="col">{en ? "Net Profit" : "Net Kâr"}</th>
                    <th scope="col"></th>
                    <th scope="col"></th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map((r) => (
                    <tr key={r.id} style={{ cursor: "pointer" }}>
                      <td style={{ fontWeight: 500 }} onClick={() => void handleSelectHistoryReport(r.id)}>{r.fileName}</td>
                      <td onClick={() => void handleSelectHistoryReport(r.id)}>{formatDate(r.createdAt, true)}</td>
                      <td onClick={() => void handleSelectHistoryReport(r.id)}>{formatCurrency(Number(r.totalRevenue))}</td>
                      <td
                        onClick={() => void handleSelectHistoryReport(r.id)}
                        style={{ color: Number(r.totalProfit) >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
                      >
                        {formatCurrency(Number(r.totalProfit))}
                      </td>
                      <td onClick={() => void handleSelectHistoryReport(r.id)}><span className="badge badge-info">{en ? "View" : "Görüntüle"}</span></td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}
                          style={{ padding: "3px 8px", fontSize: "11px", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                        >
                          {en ? "Delete" : "Sil"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {deleteTarget && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
            <div className="card" style={{ width: "100%", maxWidth: "380px", padding: "var(--spacing-6)", textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🗑️</div>
              <h3 style={{ fontWeight: 700, marginBottom: "8px" }}>{en ? "Delete Report" : "Raporu Sil"}</h3>
              <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--spacing-5)", fontSize: "14px" }}>
                {en
                  ? `Are you sure you want to delete "${deleteTarget.fileName}"?`
                  : `"${deleteTarget.fileName}" adlı raporu silmek istediğinizden emin misiniz?`}
              </p>
              <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>{en ? "Cancel" : "İptal"}</button>
                <button className="btn" style={{ flex: 1, background: "var(--color-danger)", color: "white" }}
                  onClick={() => void handleDeleteReport()} disabled={deletingReport}>
                  {deletingReport ? (en ? "Deleting..." : "Siliniyor...") : (en ? "Yes, Delete" : "Evet, Sil")}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  if (phase === "mapping" && mappingData) {
    const missingLabels = INVENTORY_FIELDS
      .filter((f) => f.required && !columnOverride[f.key])
      .map((f) => (en ? f.en : f.tr));

    return (
      <main className="page-content">
        <div style={{ marginBottom: "var(--spacing-8)" }}>
          <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "var(--spacing-2)" }}>
            {en ? "Column Mapping" : "Kolon Eşleştirme"}
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            {en
              ? "The system auto-mapped the columns below. Review and fix any wrong fields before creating the analysis."
              : "Sistem aşağıdaki sütunları otomatik eşleştirdi. Analizi oluşturmadan önce yanlış alanları düzeltin."}
          </p>
        </div>

        <ViewTabs viewMode={viewMode} onSelect={handleSelectTab} en={en} />

        <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            {INVENTORY_FIELDS.map((f) => {
              const selectedHeader = columnOverride[f.key];
              const samples = selectedHeader
                ? mappingData.rows
                    .slice(0, 3)
                    .map((r) => String(r.rawData[selectedHeader] ?? "").trim())
                    .filter((v) => v !== "")
                : [];
              return (
                <div key={f.key} className="responsive-grid responsive-grid-sidebar" style={{
                  gap: "var(--spacing-4)",
                  alignItems: "start", padding: "var(--spacing-3) 0",
                  borderBottom: "1px solid var(--color-border)",
                }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: "4px", display: "block" }}>
                      {en ? f.en : f.tr}{f.required ? " *" : ""}
                    </label>
                    <p style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                      {en ? f.hintEn : f.hintTr}
                    </p>
                  </div>
                  <div>
                    <select
                      className="form-input"
                      value={selectedHeader ?? ""}
                      onChange={(e) =>
                        setColumnOverride((prev) => ({ ...prev, [f.key]: e.target.value || null }))
                      }
                    >
                      <option value="">{en ? "— Not Selected —" : "— Seçilmedi —"}</option>
                      {mappingData.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <div style={{ marginTop: "6px", fontSize: "12px", minHeight: "18px" }}>
                      {selectedHeader ? (
                        samples.length > 0 ? (
                          <span style={{ color: "var(--color-text-muted)" }}>
                            {en ? "Sample values: " : "Örnek değerler: "}
                            <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{samples.join(" · ")}</span>
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-text-muted)" }}>
                            {en ? "This column appears to be empty in the first rows." : "Bu sütun ilk satırlarda boş görünüyor."}
                          </span>
                        )
                      ) : (
                        <span style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
                          {en ? "Select a column to preview its values" : "Değerleri görmek için bir sütun seçin"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {missingLabels.length > 0 && (
            <div style={{
              marginTop: "var(--spacing-4)",
              padding: "12px 14px",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              color: "#92400e",
            }}>
              ⚠ {en
                ? "This field may leave calculations incomplete if left unmapped:"
                : "Bu alan boş bırakılırsa hesaplamalar eksik olabilir:"} {missingLabels.join(", ")}
            </div>
          )}

          <div style={{ display: "flex", gap: "var(--spacing-3)", marginTop: "var(--spacing-5)" }}>
            <button className="btn btn-secondary" onClick={handleBackToUpload}>
              {en ? "← Back" : "← Geri"}
            </button>
            <button className="btn btn-primary" onClick={handleCreateAnalysis}>
              {en ? "Create Analysis" : "Analizi Oluştur"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (phase === "analysis" && analysis) {
    return (
      <main className="page-content">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--spacing-6)", flexWrap: "wrap", gap: "var(--spacing-3)" }}>
          <div>
            <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "var(--spacing-1)" }}>
              {en ? "Inventory Analysis" : "Envanter Analizi"}
            </h1>
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
              {inventoryRows.length} {en ? "products analyzed" : "ürün analiz edildi"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-3)", flexWrap: "wrap" }}>
            {saveMessage && (
              <span style={{ fontSize: "13px", color: saveState === "error" ? "var(--color-danger)" : "var(--color-success)" }}>
                {saveState === "error" ? "⚠ " : "✓ "}{saveMessage}
              </span>
            )}
            <button
              className="btn btn-primary"
              disabled={saveState === "saving" || saveState === "saved"}
              onClick={() => void handleSave()}
            >
              {saveState === "saving"
                ? (en ? "Saving..." : "Kaydediliyor...")
                : saveState === "saved"
                  ? (en ? "Saved" : "Kaydedildi")
                  : (en ? "Save" : "Kaydet")}
            </button>
            {mappingData && (
              <button className="btn btn-secondary" onClick={() => setPhase("mapping")} title={en ? "Fix a column if the automatic mapping got something wrong" : "Otomatik eşleştirme bir şeyi yanlış aldıysa düzeltin"}>
                {en ? "Edit Columns" : "Sütunları Düzenle"}
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleReset}>
              {en ? "Upload New Report" : "Yeni Rapor Yükle"}
            </button>
          </div>
        </div>

        <ViewTabs viewMode={viewMode} onSelect={handleSelectTab} en={en} />

        <AnalysisDashboard analysis={analysis} inventoryRows={inventoryRows} lang={lang} />
      </main>
    );
  }

  return (
    <main className="page-content">
      <div style={{ marginBottom: "var(--spacing-8)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "var(--spacing-2)" }}>
          {en ? "Upload Inventory Report" : "Envanter Raporu Yükle"}
        </h1>
        <p style={{ color: "var(--color-text-muted)" }}>
          {en
            ? "Upload your pharmacy inventory report. The system automatically analyzes sold and unsold products."
            : "Eczane envanter raporunuzu yükleyin. Sistem satılan ve satılmayan ürünleri otomatik analiz eder."}
        </p>
      </div>

      <ViewTabs viewMode={viewMode} onSelect={handleSelectTab} en={en} />

      <LastUploadBanner report={lastReport} loaded={lastReportLoaded} en={en} />

      <div style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        padding: "var(--spacing-6)",
        marginBottom: "var(--spacing-6)",
      }}>
        <h2 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-3)" }}>
          {en ? "Supported Column Names" : "Desteklenen Sütun Adları"}
        </h2>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginBottom: "var(--spacing-3)" }}>
          {en
            ? "The system auto-detects the following columns. Similar names are recognized even if not an exact match:"
            : "Sistem aşağıdaki sütunları otomatik tanır. Başlıklar tam eşleşmese de benzer isimler algılanır:"}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacing-2)" }}>
          {en
            ? [
                "Product Name / Drug Name",
                "Barcode / Drug Code",
                "Category / Group",
                "Units Sold / Outflow",
                "Remaining Stock / Period End",
                "Purchase Price / Cost",
                "Sale Price / S.P.",
              ].map((label) => (
                <span key={label} className="badge badge-info" style={{ fontSize: "var(--font-size-xs)" }}>
                  {label}
                </span>
              ))
            : [
                "Ürün Adı / İlaç Adı",
                "Barkod / İlaç Kodu",
                "Kategori / Grup",
                "Satış Adedi / Çıkış",
                "Kalan Stok / Dönem Sonu",
                "Alış Fiyatı / Maliyet",
                "Satış Fiyatı / S.F.",
              ].map((label) => (
                <span key={label} className="badge badge-info" style={{ fontSize: "var(--font-size-xs)" }}>
                  {label}
                </span>
              ))
          }
        </div>
      </div>

      <FileUploadWithReview
        moduleName="INVENTORY"
        onConfirm={handleConfirm}
        acceptedTypes=".xlsx,.xls,.csv,.pdf"
        maxFileSizeMB={100}
        lang={lang}
      />
    </main>
  );
}
