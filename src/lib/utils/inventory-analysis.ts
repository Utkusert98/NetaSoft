export interface InventoryRow {
  name: string;
  barcode: string;
  category: string;
  openingStock: number;
  purchaseQty: number;
  salesQty: number;
  closingStock: number;
  purchasePrice: number;
  salePrice: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  revenue: number;
  profit: number;
}

export interface InventoryAnalysis {
  summary: {
    totalProducts: number;
    soldProducts: number;
    unsoldProducts: number;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    profitableCount: number;
    unprofitableCount: number;
    profitMargin: number;
  };
  topSellers: InventoryRow[];
  unsoldProducts: InventoryRow[];
  profitableProducts: InventoryRow[];
  categoryBreakdown: CategoryBreakdown[];
  profitByProduct: Array<{ name: string; profit: number; margin: number }>;
}

// NOT: Tüm alias'lar yeterince spesifik ifadeler olmalı. Tek kelimelik/çok genel
// alias'lar (ör. "satış", "önce") başka bir alanın başlığıyla (ör. "Satış Fiyatı")
// yanlışlıkla eşleşip iki farklı alanın AYNI sütunu göstermesine yol açabilir —
// bu da örn. adet yerine fiyatın kullanılmasıyla tutarların karesi alınmış gibi
// devasa yanlış sonuçlar üretir. Eşleştirme ayrıca aşağıda `detectColumn` içinde
// her alan için daha önce başka bir alana atanmış başlıkları hariç tutarak
// aynı sütunun iki alana birden atanmasını da yapısal olarak engeller.
const COLUMN_ALIASES: Record<keyof InventoryRow, string[]> = {
  name: ["ürün adı", "ilaç adı", "malzeme adı", "stok adı", "ürün açıklaması"],
  barcode: ["barkod", "karekod", "ilaç kodu", "ürün kodu", "stok kodu"],
  category: ["kategori", "ürün grubu", "ana grup", "ilaç grubu", "terapötik grup"],
  openingStock: ["dönem başı stok", "başlangıç stok", "açılış stok", "önceki dönem stok", "devir stok"],
  purchaseQty: ["alış adedi", "alış miktarı", "giriş adedi", "satın alınan", "alım miktarı"],
  salesQty: ["satış adedi", "satış miktarı", "çıkış adedi", "satılan adet", "satılan miktar", "tüketilen adet"],
  closingStock: ["dönem sonu stok", "bitiş stok", "kapanış stok", "kalan stok", "mevcut stok", "güncel stok"],
  purchasePrice: ["alış fiyatı", "alım fiyatı", "birim maliyet", "birim alış fiyatı"],
  salePrice: ["satış fiyatı", "perakende fiyatı", "liste fiyatı", "birim satış fiyatı"],
};

function detectColumn(headers: string[], field: keyof InventoryRow, claimed: Set<string>): string | null {
  const aliases = COLUMN_ALIASES[field];
  const normalized = headers.map((h) => h.toLowerCase().trim());

  // 1. geçiş: tam eşleşme (en güvenilir)
  for (const alias of aliases) {
    const idx = normalized.findIndex((h, i) => h === alias && !claimed.has(headers[i]));
    if (idx !== -1) { claimed.add(headers[idx]); return headers[idx]; }
  }
  // 2. geçiş: başlık, alias ifadesini bir bütün olarak içeriyor (ters yönde değil —
  // kısa bir alias'ın uzun bir başlığın rastgele bir parçasına denk gelmesini önler)
  for (const alias of aliases) {
    const idx = normalized.findIndex((h, i) => h.includes(alias) && !claimed.has(headers[i]));
    if (idx !== -1) { claimed.add(headers[idx]); return headers[idx]; }
  }
  return null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  const str = String(value ?? "").replace(/[,\s]/g, ".").replace(/[^0-9.-]/g, "");
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

export type InventoryColumnMap = Record<keyof InventoryRow, string | null>;

// Başlıkları otomatik alanlara eşler. Sıralama önemlidir: her alan yalnızca daha
// önce başka bir alana atanmamış bir başlığı alabilir (bkz. `claimed` seti),
// böylece iki farklı alan (ör. adet ve fiyat) aynı sütuna atanamaz.
export function detectInventoryColumnMap(headers: string[]): InventoryColumnMap {
  const claimed = new Set<string>();
  return {
    name: detectColumn(headers, "name", claimed),
    barcode: detectColumn(headers, "barcode", claimed),
    category: detectColumn(headers, "category", claimed),
    salePrice: detectColumn(headers, "salePrice", claimed),
    purchasePrice: detectColumn(headers, "purchasePrice", claimed),
    salesQty: detectColumn(headers, "salesQty", claimed),
    purchaseQty: detectColumn(headers, "purchaseQty", claimed),
    closingStock: detectColumn(headers, "closingStock", claimed),
    openingStock: detectColumn(headers, "openingStock", claimed),
  };
}

export function parseInventoryRows(
  headers: string[],
  rows: Array<{ rawData: Record<string, unknown> }>,
  columnOverride?: Partial<InventoryColumnMap>,
): InventoryRow[] {
  const colMap: InventoryColumnMap = { ...detectInventoryColumnMap(headers), ...columnOverride };

  return rows.map((row) => {
    const get = (col: string | null): unknown => (col ? row.rawData[col] : "");

    const salesQty = toNumber(get(colMap.salesQty));
    const closingStock = toNumber(get(colMap.closingStock));
    const openingStock = toNumber(get(colMap.openingStock));
    const purchaseQty = toNumber(get(colMap.purchaseQty));

    return {
      name: String(get(colMap.name) ?? "").trim() || "Bilinmeyen Ürün",
      barcode: String(get(colMap.barcode) ?? "").trim(),
      category: String(get(colMap.category) ?? "").trim() || "Genel",
      openingStock,
      purchaseQty,
      salesQty,
      closingStock: closingStock || Math.max(0, openingStock + purchaseQty - salesQty),
      purchasePrice: toNumber(get(colMap.purchasePrice)),
      salePrice: toNumber(get(colMap.salePrice)),
    };
  }).filter((r) => r.name !== "Bilinmeyen Ürün" || r.barcode !== "");
}

export function analyzeInventory(rows: InventoryRow[]): InventoryAnalysis {
  const soldProducts = rows.filter((r) => r.salesQty > 0);
  const unsoldProducts = rows.filter((r) => r.salesQty === 0);

  const totalRevenue = soldProducts.reduce(
    (sum, r) => sum + r.salesQty * r.salePrice,
    0,
  );
  const totalCost = soldProducts.reduce(
    (sum, r) => sum + r.salesQty * r.purchasePrice,
    0,
  );
  const totalProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const profitableCount = rows.filter(
    (r) => r.salePrice > 0 && r.purchasePrice > 0 && r.salePrice > r.purchasePrice,
  ).length;
  const unprofitableCount = rows.filter(
    (r) => r.salePrice > 0 && r.purchasePrice > 0 && r.salePrice <= r.purchasePrice,
  ).length;

  const topSellers = [...soldProducts]
    .sort((a, b) => b.salesQty - a.salesQty)
    .slice(0, 10);

  const profitableProducts = rows
    .filter((r) => r.salePrice > 0 && r.purchasePrice > 0)
    .map((r) => ({
      ...r,
      unitProfit: r.salePrice - r.purchasePrice,
      totalProfit: r.salesQty * (r.salePrice - r.purchasePrice),
    }))
    .sort((a, b) => b.totalProfit - a.totalProfit)
    .slice(0, 10)
    .map(({ unitProfit: _u, totalProfit: _t, ...r }) => r);

  const categoryMap = new Map<string, CategoryBreakdown>();
  rows.forEach((r) => {
    const cat = r.category || "Genel";
    const existing = categoryMap.get(cat) ?? { category: cat, count: 0, revenue: 0, profit: 0 };
    existing.count++;
    existing.revenue += r.salesQty * r.salePrice;
    existing.profit += r.salesQty * (r.salePrice - r.purchasePrice);
    categoryMap.set(cat, existing);
  });
  const categoryBreakdown = Array.from(categoryMap.values())
    .sort((a, b) => b.revenue - a.revenue);

  const profitByProduct = [...soldProducts]
    .filter((r) => r.salePrice > 0 && r.purchasePrice > 0)
    .map((r) => {
      const profit = r.salesQty * (r.salePrice - r.purchasePrice);
      const margin = r.salePrice > 0 ? ((r.salePrice - r.purchasePrice) / r.salePrice) * 100 : 0;
      return { name: r.name, profit, margin };
    })
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);

  return {
    summary: {
      totalProducts: rows.length,
      soldProducts: soldProducts.length,
      unsoldProducts: unsoldProducts.length,
      totalRevenue,
      totalCost,
      totalProfit,
      profitableCount,
      unprofitableCount,
      profitMargin,
    },
    topSellers,
    unsoldProducts: unsoldProducts.slice(0, 50),
    profitableProducts,
    categoryBreakdown,
    profitByProduct,
  };
}
