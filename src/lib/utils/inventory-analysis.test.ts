import { describe, it, expect } from "vitest";
import { detectInventoryColumnMap, isAutoMappingConfident, parseInventoryRows, analyzeInventory } from "./inventory-analysis";

// Gerçek bir eczane "stok değerleme" dışa aktarımından alınan başlıklar ve örnek
// satırlar (bkz. envanter_temmuz_ayi.xls). Bu dosya biçiminde dönem içi "satış
// adedi" sütunu YOKTUR — yalnızca o anki stok adedi ve fiyat/maliyet bilgisi vardır.
const REAL_HEADERS = [
  "Barkod", "Ürün Grubu", "Ürün Adı", "Stok Adet", "Kdv", "Satış Fiyatı",
  "Toplam Satış Fiyatı", "DF (Kdvsiz)", "Toplam DF (Kdvsiz)",
  "Maliyet (Kdvsiz)", "Toplam Maliyet (Kdvsiz)", "Maliyet (Kdvli)", "Toplam Maliyet (Kdvli)",
];

function makeRow(values: unknown[]): { rawData: Record<string, unknown> } {
  const rawData: Record<string, unknown> = {};
  REAL_HEADERS.forEach((h, i) => { rawData[h] = values[i]; });
  return { rawData };
}

const REAL_ROWS = [
  makeRow(["810071801020", "İTRİYAT", "REBUL ICE 50 ML", 2, 10, 250, 500, 123.71, 247.42, 123.71, 247.42, 136.08, 272.16]),
  makeRow(["8690742311629", "İLAÇ", "%0.9 IZO.NACL 250 CC.SETLI", 16, 10, 858.65, 13738.4, 650.49, 10407.84, 637.48, 10199.68, 701.23, 11219.68]),
];

describe("detectInventoryColumnMap — gerçek stok değerleme dosyası", () => {
  it("ürün adı, barkod, kategori, stok adedi, satış fiyatı ve maliyeti doğru eşler", () => {
    const map = detectInventoryColumnMap(REAL_HEADERS);
    expect(map.name).toBe("Ürün Adı");
    expect(map.barcode).toBe("Barkod");
    expect(map.category).toBe("Ürün Grubu");
    expect(map.closingStock).toBe("Stok Adet");
    expect(map.salePrice).toBe("Satış Fiyatı");
    // "maliyet (kdvli)" alias listede önce geldiği için Kdvli sütunu seçilir
    expect(map.purchasePrice).toBe("Maliyet (Kdvli)");
  });

  it("bu dosyada satış adedi sütunu bulunamaz (dosyada gerçekten yok)", () => {
    const map = detectInventoryColumnMap(REAL_HEADERS);
    expect(map.salesQty).toBeNull();
  });

  it("'Toplam Satış Fiyatı' gibi önceden hesaplanmış toplam sütunlar birim fiyat sanılmaz", () => {
    const map = detectInventoryColumnMap(REAL_HEADERS);
    expect(map.salePrice).not.toBe("Toplam Satış Fiyatı");
  });

  it("temel alanlar (ad, fiyat, stok) bulunduğunda otomatik eşleştirme güvenilir sayılır", () => {
    const map = detectInventoryColumnMap(REAL_HEADERS);
    expect(isAutoMappingConfident(map)).toBe(true);
  });
});

describe("analyzeInventory — satış verisi olmayan stok değerleme dosyası", () => {
  const parsed = parseInventoryRows(REAL_HEADERS, REAL_ROWS);
  const analysis = analyzeInventory(parsed);

  it("hasSalesData false döner (dosyada satış adedi yok)", () => {
    expect(analysis.hasSalesData).toBe(false);
  });

  it("stok değeri makul bir büyüklükte hesaplanır (kare alma hatası yok)", () => {
    // Beklenen: 2*250 + 16*858.65 = 500 + 13738.4 = 14238.4
    expect(analysis.summary.totalStockValue).toBeCloseTo(14238.4, 1);
  });

  it("gelir/kâr sıfırdır çünkü satış adedi bilgisi yok", () => {
    expect(analysis.summary.totalRevenue).toBe(0);
    expect(analysis.summary.totalProfit).toBe(0);
  });

  it("stok değerine göre en değerli ürünler listesi doludur", () => {
    expect(analysis.topByStockValue.length).toBe(2);
    expect(analysis.topByStockValue[0].name).toContain("IZO.NACL");
  });
});
