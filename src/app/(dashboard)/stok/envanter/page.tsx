"use client";

import { useState } from "react";
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

// recharts v3 Tooltip formatter tipi intersection kullanıyor — any cast gerekli
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFormatter = (...args: any[]) => any;
import FileUploadWithReview from "@/components/file-upload/FileUploadWithReview";
import {
  parseInventoryRows,
  analyzeInventory,
  type InventoryAnalysis,
  type InventoryRow,
} from "@/lib/utils/inventory-analysis";
import { formatCurrency } from "@/lib/utils";

interface ParsedRow {
  rowIndex: number;
  rawData: Record<string, unknown>;
  isValid: boolean;
  errors?: string[];
}

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

function TopSellersChart({ data, lang }: { data: InventoryRow[]; lang: string }) {
  const en = lang === "en";
  const chartData = data.map((r) => ({
    name: r.name.length > 20 ? r.name.slice(0, 18) + "…" : r.name,
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
            formatter={((value: string | number | undefined, name?: string | number) => {
              const v = Number(value ?? 0);
              return String(name) === "adet"
                ? [v.toLocaleString("tr-TR") + (en ? " units" : " adet"), en ? "Sales" : "Satış"]
                : [formatCurrency(v), en ? "Revenue" : "Gelir"];
            }) as AnyFormatter}
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend formatter={(v) => v === "adet" ? (en ? "Units Sold" : "Satış Adedi") : (en ? "Revenue (₺)" : "Gelir (₺)")} />
          <Bar dataKey="adet" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
          <Bar dataKey="gelir" fill={CHART_COLORS[3]} radius={[0, 4, 4, 0]} />
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
            formatter={((value: string | number | undefined) => [Number(value ?? 0).toLocaleString("tr-TR") + (en ? " products" : " ürün")]) as AnyFormatter}
            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProfitChart({ data, lang }: { data: Array<{ name: string; profit: number; margin: number }>; lang: string }) {
  const en = lang === "en";
  const chartData = data.map((r) => ({
    name: r.name.length > 16 ? r.name.slice(0, 14) + "…" : r.name,
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
            }) as AnyFormatter}
            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
          />
          <Bar dataKey="kar" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AnalysisDashboard({ analysis, inventoryRows, lang }: {
  analysis: InventoryAnalysis;
  inventoryRows: InventoryRow[];
  lang: string;
}) {
  const en = lang === "en";
  const { summary } = analysis;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-8)" }}>
      <section>
        <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
          {en ? "Inventory Summary" : "Envanter Özeti"}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--spacing-4)" }}>
          <SummaryCard label={en ? "Total Products" : "Toplam Ürün"} value={summary.totalProducts.toLocaleString("tr-TR")} />
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
          <SummaryCard
            label={en ? "Total Revenue" : "Toplam Gelir"}
            value={formatCurrency(summary.totalRevenue)}
            accent="primary"
          />
          <SummaryCard
            label={en ? "Net Profit" : "Net Kâr"}
            value={formatCurrency(summary.totalProfit)}
            sub={`${summary.profitMargin.toFixed(1)}% ${en ? "profit margin" : "kâr marjı"}`}
            accent={summary.totalProfit >= 0 ? "success" : "danger"}
          />
          <SummaryCard
            label={en ? "Profitable Products" : "Kârlı Ürün"}
            value={`${summary.profitableCount} / ${summary.totalProducts}`}
            sub={`${summary.unprofitableCount} ${en ? "unprofitable products" : "kârsız ürün"}`}
          />
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--spacing-6)" }}>
        <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
          <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
            {en ? "Top 10 Best-Selling Products" : "En Çok Satan 10 Ürün"}
          </h3>
          {analysis.topSellers.length > 0
            ? <TopSellersChart data={analysis.topSellers} lang={lang} />
            : <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "40px" }}>{en ? "No sales data found" : "Satış verisi bulunamadı"}</p>
          }
        </section>

        <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
          <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
            {en ? "Sales Distribution" : "Satış Dağılımı"}
          </h3>
          <SoldUnsoldPieChart sold={summary.soldProducts} unsold={summary.unsoldProducts} lang={lang} />
        </section>
      </div>

      {analysis.profitByProduct.length > 0 && (
        <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
          <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
            {en ? "Top 10 Most Profitable Products" : "En Kârlı 10 Ürün"}
          </h3>
          <ProfitChart data={analysis.profitByProduct} lang={lang} />
        </section>
      )}

      {analysis.categoryBreakdown.length > 1 && (
        <section style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: "var(--spacing-6)" }}>
          <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
            {en ? "Revenue by Category" : "Kategori Bazında Gelir"}
          </h3>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis.categoryBreakdown} margin={{ left: 8, right: 16, top: 8, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: "var(--color-text)" }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => formatCurrency(v)} />
                <Tooltip
                  formatter={((value: string | number | undefined, name?: string | number) => {
                    const v = Number(value ?? 0);
                    return String(name) === "revenue" ? [formatCurrency(v), en ? "Revenue" : "Gelir"] : [formatCurrency(v), en ? "Profit" : "Kâr"];
                  }) as AnyFormatter}
                  contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
                />
                <Legend formatter={(v) => v === "revenue" ? (en ? "Revenue" : "Gelir") : (en ? "Profit" : "Kâr")} />
                <Bar dataKey="revenue" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {analysis.unsoldProducts.length > 0 && (
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
                <th scope="col">{en ? "Units Sold" : "Satış Adedi"}</th>
                <th scope="col">{en ? "Remaining Stock" : "Kalan Stok"}</th>
                <th scope="col">{en ? "Purchase Price" : "Alış Fiyatı"}</th>
                <th scope="col">{en ? "Sale Price" : "Satış Fiyatı"}</th>
                <th scope="col">{en ? "Profit/Unit" : "Kâr/Ürün"}</th>
                <th scope="col">{en ? "Total Profit" : "Toplam Kâr"}</th>
              </tr>
            </thead>
            <tbody>
              {inventoryRows.map((row, i) => {
                const unitProfit = row.salePrice - row.purchasePrice;
                const totalProfit = row.salesQty * unitProfit;
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{row.name}</td>
                    <td style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{row.barcode || "—"}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: row.salesQty > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}>
                        {row.salesQty.toLocaleString("tr-TR")}
                      </span>
                    </td>
                    <td>{row.closingStock.toLocaleString("tr-TR")}</td>
                    <td>{row.purchasePrice > 0 ? formatCurrency(row.purchasePrice) : "—"}</td>
                    <td>{row.salePrice > 0 ? formatCurrency(row.salePrice) : "—"}</td>
                    <td style={{ color: unitProfit >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                      {row.salePrice > 0 && row.purchasePrice > 0 ? formatCurrency(unitProfit) : "—"}
                    </td>
                    <td style={{ fontWeight: 600, color: totalProfit >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                      {row.salesQty > 0 && row.salePrice > 0 && row.purchasePrice > 0
                        ? formatCurrency(totalProfit)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export default function EnvanterPage() {
  const { lang } = useLangContext();
  const en = lang === "en";
  const [analysis, setAnalysis] = useState<InventoryAnalysis | null>(null);
  const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>([]);

  const handleConfirm = async (rows: ParsedRow[], headers: string[]): Promise<void> => {
    const validRows = rows.filter((r) => r.isValid);
    const parsed = parseInventoryRows(headers, validRows);
    const result = analyzeInventory(parsed);
    setInventoryRows(parsed);
    setAnalysis(result);
  };

  const handleReset = () => {
    setAnalysis(null);
    setInventoryRows([]);
  };

  if (analysis) {
    return (
      <main>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--spacing-8)" }}>
          <div>
            <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "var(--spacing-1)" }}>
              {en ? "Inventory Analysis" : "Envanter Analizi"}
            </h1>
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
              {inventoryRows.length} {en ? "products analyzed" : "ürün analiz edildi"}
            </p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={handleReset}
          >
            {en ? "Upload New Report" : "Yeni Rapor Yükle"}
          </button>
        </div>
        <AnalysisDashboard analysis={analysis} inventoryRows={inventoryRows} lang={lang} />
      </main>
    );
  }

  return (
    <main>
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
