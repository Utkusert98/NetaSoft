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
  stockValue: number;
  stockCost: number;
}

export interface InventoryAnalysis {
  // Türkiye'deki eczane dışa aktarımlarının çoğu bir "stok değerleme" raporudur
  // (o anki stok adedi + fiyat/maliyet) — dönem içi satış adedi içermez. Bu alan
  // gerçek bir satış adedi sütunu bulunduğunda (ve en az bir satırda sıfırdan
  // farklı bir değer taşıdığında) true olur; aksi halde satış bazlı grafikler
  // (en çok satan, satılan/satılmayan vb.) gösterilmez, stok değeri bazlı
  // grafikler gösterilir — bu her zaman anlamlıdır çünkü sadece stok adedi ve
  // fiyat gerektirir.
  hasSalesData: boolean;
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
    // Stok değeri — her zaman hesaplanır (satış verisi olmasa bile anlamlıdır)
    totalStockValue: number;
    totalStockCost: number;
    potentialProfit: number;
    potentialMargin: number;
  };
  topSellers: InventoryRow[];
  unsoldProducts: InventoryRow[];
  profitableProducts: InventoryRow[];
  categoryBreakdown: CategoryBreakdown[];
  profitByProduct: Array<{ name: string; profit: number; margin: number }>;
  // Stok değerine göre en değerli 10 ürün — satış verisi olmasa bile her zaman dolu
  topByStockValue: Array<{ name: string; stockValue: number; closingStock: number }>;
}

// NOT: Tüm alias'lar yeterince spesifik ifadeler olmalı. Tek kelimelik/çok genel
// alias'lar (ör. "satış", "önce") başka bir alanın başlığıyla (ör. "Satış Fiyatı")
// yanlışlıkla eşleşip iki farklı alanın AYNI sütunu göstermesine yol açabilir —
// bu da örn. adet yerine fiyatın kullanılmasıyla tutarların karesi alınmış gibi
// devasa yanlış sonuçlar üretir. Eşleştirme ayrıca aşağıda `detectColumn` içinde
// her alan için daha önce başka bir alana atanmış başlıkları hariç tutarak
// aynı sütunun iki alana birden atanmasını da yapısal olarak engeller.
//
// Alias listeleri gerçek eczane dışa aktarım dosyalarından (ör. "Barkod, Ürün
// Grubu, Ürün Adı, Stok Adet, Kdv, Satış Fiyatı, Toplam Satış Fiyatı,
// Maliyet (Kdvsiz), Maliyet (Kdvli)...") doğrulanmıştır — bu, en yaygın stok
// değerleme raporu biçimidir ve dönem içi "satış adedi" sütunu İÇERMEZ.
const COLUMN_ALIASES: Record<keyof InventoryRow, string[]> = {
  name: ["ürün adı", "ilaç adı", "malzeme adı", "stok adı", "ürün açıklaması"],
  barcode: ["barkod", "karekod", "ilaç kodu", "ürün kodu", "stok kodu"],
  category: ["ürün grubu", "kategori", "ana grup", "ilaç grubu", "terapötik grup"],
  openingStock: ["dönem başı stok", "başlangıç stok", "açılış stok", "önceki dönem stok", "devir stok"],
  purchaseQty: ["alış adedi", "alış miktarı", "giriş adedi", "satın alınan", "alım miktarı"],
  salesQty: ["satış adedi", "satış miktarı", "çıkış adedi", "satılan adet", "satılan miktar", "tüketilen adet"],
  closingStock: ["stok adet", "dönem sonu stok", "bitiş stok", "kapanış stok", "kalan stok", "mevcut stok", "güncel stok"],
  purchasePrice: ["maliyet (kdvli)", "maliyet kdvli", "maliyet (kdvsiz)", "maliyet kdvsiz", "birim maliyet", "alış fiyatı", "alım fiyatı", "birim alış fiyatı", "maliyet"],
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
  // kısa bir alias'ın uzun bir başlığın rastgele bir parçasına denk gelmesini önler).
  // "Toplam ..." ile başlayan önceden hesaplanmış toplam sütunları burada bilerek
  // atlanır (ör. "Toplam Satış Fiyatı" birim fiyat değil, adet×fiyat çarpımıdır) —
  // aksi halde bu sütun yanlışlıkla birim fiyat sütunu sanılabilir.
  for (const alias of aliases) {
    const idx = normalized.findIndex((h, i) =>
      h.includes(alias) && !h.startsWith("toplam ") && !claimed.has(headers[i]));
    if (idx !== -1) { claimed.add(headers[idx]); return headers[idx]; }
  }
  return null;
}

/**
 * Uzun ürün/kategori adlarını grafik eksenlerinde okunaklı kalması için kısaltır.
 * Örn. "PARASETAMOL 500 MG 20 TABLET KUTUSU" (20 karakter) → "PARASETAMOL 500 MG…"
 */
export function truncateLabel(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, Math.max(0, maxLen - 1)) + "…";
}

/**
 * Bir liste çok fazla dilim/çubuk içeriyorsa (ör. onlarca kategori) grafik
 * okunaksız hale gelir. Bu fonksiyon değere göre sıralar, ilk N kalemi bırakır
 * ve kalanları tek bir "Diğer" toplamı altında birleştirir — pasta ve çubuk
 * grafiklerde tutarlı bir kırpma davranışı sağlar.
 */
export function topNWithOther<T extends Record<string, unknown>>(
  items: T[],
  labelKey: keyof T,
  valueKey: keyof T,
  n: number,
): { top: T[]; otherLabels: string[]; otherSum: number } {
  const sorted = [...items].sort((a, b) => Number(b[valueKey]) - Number(a[valueKey]));
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n);
  const otherSum = rest.reduce((s, d) => s + Number(d[valueKey]), 0);
  const otherLabels = rest.map((d) => String(d[labelKey]));
  return { top, otherLabels, otherSum };
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

/** En az 4 temel alan (ad + en az bir fiyat + en az bir stok/adet sütunu) otomatik bulunduysa, kullanıcıdan manuel eşleştirme istemeye gerek yoktur. */
export function isAutoMappingConfident(colMap: InventoryColumnMap): boolean {
  const hasName = !!colMap.name;
  const hasPrice = !!colMap.salePrice || !!colMap.purchasePrice;
  const hasQty = !!colMap.closingStock || !!colMap.salesQty || !!colMap.openingStock;
  return hasName && hasPrice && hasQty;
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
  const hasSalesData = rows.some((r) => r.salesQty > 0);

  const soldProducts = rows.filter((r) => r.salesQty > 0);
  const unsoldProducts = rows.filter((r) => r.salesQty === 0);

  const totalRevenue = soldProducts.reduce((sum, r) => sum + r.salesQty * r.salePrice, 0);
  const totalCost = soldProducts.reduce((sum, r) => sum + r.salesQty * r.purchasePrice, 0);
  const totalProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Stok değeri: elde mevcut ürünlerin satış fiyatı üzerinden toplam değeri.
  // Bu, satış adedi olmasa bile HER ZAMAN hesaplanabilir ve anlamlıdır —
  // "stoktaki ürünler satılırsa ne kadar gelir/kâr elde edilir" sorusuna cevap verir.
  const totalStockValue = rows.reduce((sum, r) => sum + r.closingStock * r.salePrice, 0);
  const totalStockCost = rows.reduce((sum, r) => sum + r.closingStock * r.purchasePrice, 0);
  const potentialProfit = totalStockValue - totalStockCost;
  const potentialMargin = totalStockValue > 0 ? (potentialProfit / totalStockValue) * 100 : 0;

  const profitableCount = rows.filter(
    (r) => r.salePrice > 0 && r.purchasePrice > 0 && r.salePrice > r.purchasePrice,
  ).length;
  const unprofitableCount = rows.filter(
    (r) => r.salePrice > 0 && r.purchasePrice > 0 && r.salePrice <= r.purchasePrice,
  ).length;

  const topSellers = [...soldProducts]
    .sort((a, b) => b.salesQty - a.salesQty)
    .slice(0, 10);

  const topByStockValue = rows
    .map((r) => ({ name: r.name, stockValue: r.closingStock * r.salePrice, closingStock: r.closingStock }))
    .filter((r) => r.stockValue > 0)
    .sort((a, b) => b.stockValue - a.stockValue)
    .slice(0, 10);

  const profitableProducts = rows
    .filter((r) => r.salePrice > 0 && r.purchasePrice > 0)
    .map((r) => ({
      ...r,
      unitProfit: r.salePrice - r.purchasePrice,
      // Satış verisi varsa gerçekleşen kâra göre, yoksa stoktaki potansiyel kâra göre sırala
      rankProfit: hasSalesData ? r.salesQty * (r.salePrice - r.purchasePrice) : r.closingStock * (r.salePrice - r.purchasePrice),
    }))
    .sort((a, b) => b.rankProfit - a.rankProfit)
    .slice(0, 10)
    .map(({ unitProfit: _u, rankProfit: _r, ...r }) => r);

  const categoryMap = new Map<string, CategoryBreakdown>();
  rows.forEach((r) => {
    const cat = r.category || "Genel";
    const existing = categoryMap.get(cat) ?? { category: cat, count: 0, revenue: 0, profit: 0, stockValue: 0, stockCost: 0 };
    existing.count++;
    existing.revenue += r.salesQty * r.salePrice;
    existing.profit += r.salesQty * (r.salePrice - r.purchasePrice);
    existing.stockValue += r.closingStock * r.salePrice;
    existing.stockCost += r.closingStock * r.purchasePrice;
    categoryMap.set(cat, existing);
  });
  const categoryBreakdown = Array.from(categoryMap.values())
    .sort((a, b) => (hasSalesData ? b.revenue - a.revenue : b.stockValue - a.stockValue));

  const profitByProduct = hasSalesData
    ? [...soldProducts]
        .filter((r) => r.salePrice > 0 && r.purchasePrice > 0)
        .map((r) => {
          const profit = r.salesQty * (r.salePrice - r.purchasePrice);
          const margin = r.salePrice > 0 ? ((r.salePrice - r.purchasePrice) / r.salePrice) * 100 : 0;
          return { name: r.name, profit, margin };
        })
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10)
    : rows
        .filter((r) => r.salePrice > 0 && r.purchasePrice > 0 && r.closingStock > 0)
        .map((r) => {
          const profit = r.closingStock * (r.salePrice - r.purchasePrice);
          const margin = r.salePrice > 0 ? ((r.salePrice - r.purchasePrice) / r.salePrice) * 100 : 0;
          return { name: r.name, profit, margin };
        })
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10);

  return {
    hasSalesData,
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
      totalStockValue,
      totalStockCost,
      potentialProfit,
      potentialMargin,
    },
    topSellers,
    unsoldProducts: unsoldProducts.slice(0, 50),
    profitableProducts,
    categoryBreakdown,
    profitByProduct,
    topByStockValue,
  };
}
