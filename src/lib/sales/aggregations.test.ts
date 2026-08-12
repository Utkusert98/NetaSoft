import { describe, it, expect } from "vitest";
import { aggregateByStaff, hasStaffData, aggregateByDayOfWeek, discountRate, aggregatePeriodTrend, topProductsByRevenue } from "./aggregations";
import type { ParsedSaleRow } from "./mapRow";

function row(overrides: Partial<ParsedSaleRow>): ParsedSaleRow {
  return {
    productGroup: "Genel",
    productName: "Ürün",
    saleDate: "2026-08-10T00:00:00.000Z",
    price: 100,
    discountAmount: 0,
    saleType: "RETAIL",
    quantity: 1,
    netRevenue: 100,
    ...overrides,
  };
}

describe("aggregateByStaff", () => {
  it("boş staffName'leri hariç tutar", () => {
    const result = aggregateByStaff([row({ staffName: undefined }), row({ staffName: "" })]);
    expect(result).toHaveLength(0);
  });

  it("kişi bazında doğru toplar ve reçeteli yüzdesini hesaplar", () => {
    const result = aggregateByStaff([
      row({ staffName: "Ayşe", netRevenue: 100, saleType: "PRESCRIPTION" }),
      row({ staffName: "Ayşe", netRevenue: 50, saleType: "RETAIL" }),
      row({ staffName: "Mehmet", netRevenue: 200, saleType: "RETAIL" }),
    ]);
    expect(result).toHaveLength(2);
    const ayse = result.find(r => r.staffName === "Ayşe")!;
    expect(ayse.totalRevenue).toBe(150);
    expect(ayse.saleCount).toBe(2);
    expect(ayse.prescriptionPct).toBeCloseTo((100 / 150) * 100, 5);
    // en yüksek ciro önce gelir
    expect(result[0].staffName).toBe("Mehmet");
  });
});

describe("hasStaffData", () => {
  it("tüm satırlar boşsa false döner", () => {
    expect(hasStaffData([row({ staffName: undefined }), row({ staffName: "" })])).toBe(false);
  });
  it("en az bir satırda personel varsa true döner", () => {
    expect(hasStaffData([row({ staffName: undefined }), row({ staffName: "Ayşe" })])).toBe(true);
  });
});

describe("aggregateByDayOfWeek", () => {
  it("7 gün de listede yer alır, boş veri 0 içerir", () => {
    const result = aggregateByDayOfWeek([]);
    expect(result).toHaveLength(7);
    expect(result.every(d => d.avgRevenue === 0 && d.totalRevenue === 0)).toBe(true);
  });

  it("aynı haftagüne düşen farklı tarihlerin ortalamasını doğru alır", () => {
    // 2026-08-10 Pazartesi, 2026-08-17 Pazartesi
    const result = aggregateByDayOfWeek([
      row({ saleDate: "2026-08-10T00:00:00.000Z", netRevenue: 100 }),
      row({ saleDate: "2026-08-17T00:00:00.000Z", netRevenue: 300 }),
    ]);
    const monday = result.find(d => d.label === "Pazartesi")!;
    expect(monday.totalRevenue).toBe(400);
    expect(monday.avgRevenue).toBe(200); // 2 farklı gün üzerinden ortalama
  });

  it("saleTypeFilter='RETAIL' verildiğinde yalnızca perakende satışları toplulaştırır", () => {
    const result = aggregateByDayOfWeek([
      row({ saleDate: "2026-08-10T00:00:00.000Z", netRevenue: 100, saleType: "RETAIL" }),
      row({ saleDate: "2026-08-10T00:00:00.000Z", netRevenue: 500, saleType: "PRESCRIPTION" }),
    ], "tr", "RETAIL");
    const monday = result.find(d => d.label === "Pazartesi")!;
    expect(monday.totalRevenue).toBe(100);
    expect(monday.saleCount).toBe(1);
  });
});

describe("discountRate", () => {
  it("price*quantity 0 ise null döner (net tutar modu)", () => {
    expect(discountRate({ price: 100, quantity: 0, discountAmount: 10 })).toBeNull();
  });
  it("doğru yüzdeyi hesaplar", () => {
    expect(discountRate({ price: 100, quantity: 2, discountAmount: 20 })).toBeCloseTo(10, 5);
  });
});

describe("aggregatePeriodTrend", () => {
  it("boş kayıtlarda boş dizi döner", () => {
    expect(aggregatePeriodTrend([])).toEqual([]);
  });

  it("kısa aralıkta haftalık gruplar, ortalama fiş ve iskonto oranını hesaplar", () => {
    const result = aggregatePeriodTrend([
      row({ saleDate: "2026-08-10T00:00:00.000Z", netRevenue: 100, price: 100, quantity: 1, discountAmount: 10 }),
      row({ saleDate: "2026-08-11T00:00:00.000Z", netRevenue: 200, price: 200, quantity: 1, discountAmount: 0 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].avgTicket).toBe(150);
    expect(result[0].transactionCount).toBe(2);
    expect(result[0].avgDiscountRate).toBeCloseTo(5, 5); // (10 + 0) / 2
  });

  it("60 günden uzun aralıkta aylık gruplar", () => {
    const result = aggregatePeriodTrend([
      row({ saleDate: "2026-06-01T00:00:00.000Z", netRevenue: 100, price: 100, quantity: 1 }),
      row({ saleDate: "2026-08-15T00:00:00.000Z", netRevenue: 100, price: 100, quantity: 1 }),
    ]);
    expect(result.length).toBe(2);
    expect(result[0].periodKey).toBe("2026-06");
    expect(result[1].periodKey).toBe("2026-08");
  });
});

describe("topProductsByRevenue", () => {
  it("ürün adına göre toplar, gelire göre azalan sıralar ve limit uygular", () => {
    const result = topProductsByRevenue([
      row({ productName: "A", netRevenue: 100, quantity: 2 }),
      row({ productName: "A", netRevenue: 50, quantity: 1 }),
      row({ productName: "B", netRevenue: 300, quantity: 1 }),
      row({ productName: "C", netRevenue: 10, quantity: 1 }),
    ], 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ productName: "B", revenue: 300, quantity: 1 });
    expect(result[1]).toEqual({ productName: "A", revenue: 150, quantity: 3 });
  });

  it("boş productName satırlarını hariç tutar", () => {
    const result = topProductsByRevenue([row({ productName: "" }), row({ productName: "  " })]);
    expect(result).toHaveLength(0);
  });
});
