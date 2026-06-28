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

const COLUMN_ALIASES: Record<keyof InventoryRow, string[]> = {
  name: ["ürün adı", "ilaç adı", "açıklama", "tanım", "malzeme adı", "ürün", "ad", "name"],
  barcode: ["barkod", "karekod", "ilaç kodu", "ürün kodu", "kod", "barcode"],
  category: ["kategori", "grup", "tür", "sınıf", "ana grup", "category"],
  openingStock: ["dönem başı", "başlangıç stok", "açılış stok", "önce", "önceki stok"],
  purchaseQty: ["alış adet", "giriş", "satın alınan", "alım", "alış miktarı", "gelen"],
  salesQty: ["satış adet", "satış miktarı", "çıkış", "satılan", "satış", "giden", "tükenen"],
  closingStock: ["dönem sonu", "bitiş stok", "kapanış stok", "kalan stok", "mevcut stok", "stok", "envanter"],
  purchasePrice: ["alış fiyatı", "maliyet", "alım fiyatı", "kdv'siz", "net fiyat", "birim maliyet"],
  salePrice: ["satış fiyatı", "perakende", "s.f.", "satış f.", "liste fiyatı", "sf"],
};

function detectColumn(headers: string[], field: keyof InventoryRow): string | null {
  const aliases = COLUMN_ALIASES[field];
  const normalized = headers.map((h) => h.toLowerCase().trim());

  for (const alias of aliases) {
    const idx = normalized.findIndex(
      (h) => h === alias || h.includes(alias) || alias.includes(h),
    );
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  const str = String(value ?? "").replace(/[,\s]/g, ".").replace(/[^0-9.-]/g, "");
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

export function parseInventoryRows(
  headers: string[],
  rows: Array<{ rawData: Record<string, unknown> }>,
): InventoryRow[] {
  const colMap = {
    name: detectColumn(headers, "name"),
    barcode: detectColumn(headers, "barcode"),
    category: detectColumn(headers, "category"),
    openingStock: detectColumn(headers, "openingStock"),
    purchaseQty: detectColumn(headers, "purchaseQty"),
    salesQty: detectColumn(headers, "salesQty"),
    closingStock: detectColumn(headers, "closingStock"),
    purchasePrice: detectColumn(headers, "purchasePrice"),
    salePrice: detectColumn(headers, "salePrice"),
  };

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
