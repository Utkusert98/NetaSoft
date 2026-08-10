import { describe, it, expect } from "vitest";
import { mapRow, isColumnMapConfident } from "./mapRow";

describe("mapRow — sütun çakışması koruması", () => {
  // Birden fazla benzer isimli sütun içeren, gerçekçi bir zorlayıcı başlık seti:
  // hem "Fiyat" hem "İskonto Fiyatı" var; hem "Adet" hem "İskonto Adedi" var.
  // Eski (claimed seti olmayan) algoritma bunlardan yanlışını seçebilirdi.
  const headers = ["Tarih", "Ürün Adı", "Ürün Grubu", "Adet", "İskonto Adedi", "Fiyat", "İskonto Fiyatı", "Satış Tipi"];
  const row = ["10.08.2026", "PAROL 500 MG", "İLAÇ", "3", "0", "45.90", "0", "Perakende"];

  it("fiyat ve adet farklı sütunlara atanır, hiçbiri çakışmaz", () => {
    const { colMap } = mapRow(headers, row, {});
    expect(colMap.price).toBe("Fiyat");
    expect(colMap.quantity).toBe("Adet");
    expect(colMap.price).not.toBe(colMap.quantity);
  });

  it("fiyat × adet doğru hesaplanır (kare alma hatası yok)", () => {
    const { row: mapped } = mapRow(headers, row, {});
    expect(mapped.price).toBeCloseTo(45.9, 2);
    expect(mapped.quantity).toBe(3);
    expect(mapped.netRevenue).toBeCloseTo(137.7, 2);
  });

  it("ürün adı ve tarih doğru eşlenir", () => {
    const { row: mapped } = mapRow(headers, row, {});
    expect(mapped.productName).toBe("PAROL 500 MG");
    expect(mapped.saleDate.startsWith("2026-08-10")).toBe(true);
  });

  it("tam eşleşme her zaman bulanık eşleşmeden önce gelir", () => {
    // "Fiyat" tam eşleşmesi, "İskonto Fiyatı" gibi "fiyat" içeren başka bir
    // sütunun bulanık eşleşmesinden önce seçilmelidir.
    const { colMap } = mapRow(headers, row, {});
    expect(colMap.price).not.toBe("İskonto Fiyatı");
  });

  it("bu eşleştirme güvenilir sayılır (manuel düzenleme gerekmez)", () => {
    const { colMap } = mapRow(headers, row, {});
    expect(isColumnMapConfident(colMap)).toBe(true);
  });
});

describe("mapRow — net tutar modu", () => {
  const headers = ["Tarih", "Ürün Adı", "Net Tutar"];
  const row = ["10.08.2026", "OZEMPIC 1 MG", "1250.00"];

  it("net tutar sütunu adete bölünmez, quantity=1 olarak kaydedilir", () => {
    const { row: mapped, colMap } = mapRow(headers, row, {});
    expect(colMap.priceIsNet).toBe(true);
    expect(mapped.price).toBeCloseTo(1250, 2);
    expect(mapped.quantity).toBe(1);
    expect(mapped.netRevenue).toBeCloseTo(1250, 2);
  });
});
