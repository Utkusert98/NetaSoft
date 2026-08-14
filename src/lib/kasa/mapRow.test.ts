import { describe, it, expect } from "vitest";
import { mapKasaRow, aggregateKasaRowsByDate, type ParsedKasaRow } from "./mapRow";

describe("mapKasaRow", () => {
  it("Tarih/POS/Nakit/Havale başlıklı standart bir satırı doğru ayrıştırır", () => {
    const headers = ["Tarih", "POS", "Nakit", "Havale"];
    const row = ["01.11.2025", "1500", "300", "0"];
    const { row: parsed } = mapKasaRow(headers, row);
    expect(parsed.dateInvalid).toBe(false);
    expect(parsed.registerDate).toBe("2025-11-01T00:00:00.000Z");
    expect(parsed.posAmount).toBe(1500);
    expect(parsed.cashAmount).toBe(300);
    expect(parsed.wireAmount).toBe(0);
  });

  it("Türkçe İ içeren başlıkları (ör. varyasyon adları) doğru normalize eder", () => {
    const headers = ["TARİH", "Kredi Kartı", "Nakit Tutar", "Havale/EFT"];
    const row = ["15.12.2025", "2000", "450", "100"];
    const { row: parsed } = mapKasaRow(headers, row);
    expect(parsed.dateInvalid).toBe(false);
    expect(parsed.posAmount).toBe(2000);
    expect(parsed.cashAmount).toBe(450);
    expect(parsed.wireAmount).toBe(100);
  });

  it("Excel seri tarih değerini doğru ayrıştırır", () => {
    const headers = ["Tarih", "POS", "Nakit", "Havale"];
    const row = [45962, "1000", "200", "0"]; // 2025-11-01
    const { row: parsed } = mapKasaRow(headers, row);
    expect(parsed.dateInvalid).toBe(false);
    expect(parsed.registerDate.slice(0, 10)).toBe("2025-11-01");
  });

  it("tarih ayrıştırılamayan bir satırı dateInvalid ile işaretler, sessizce bugüne düşürmez", () => {
    const headers = ["Tarih", "POS", "Nakit", "Havale"];
    const row = ["geçersiz", "1000", "200", "0"];
    const { row: parsed } = mapKasaRow(headers, row);
    expect(parsed.dateInvalid).toBe(true);
  });

  it("Notlar sütununu opsiyonel olarak yakalar", () => {
    const headers = ["Tarih", "POS", "Nakit", "Havale", "Notlar"];
    const row = ["01.11.2025", "1000", "200", "0", "Bayram kapalı yarım gün"];
    const { row: parsed } = mapKasaRow(headers, row);
    expect(parsed.notes).toBe("Bayram kapalı yarım gün");
  });

  it("\"Pos Z No\" gibi bir sıra numarası sütununu POS tutarı SANMAZ (gerçek bir üretim hatasının kök nedeni)", () => {
    const headers = ["İşlem Tarihi", "Pos Z No", "Nakit", "Havale"];
    const row = ["01.11.2025", "480", "300", "0"];
    const { row: parsed, colMap } = mapKasaRow(headers, row);
    // "Pos Z No" bir tutar sütunu değil, günlük Z-raporu sıra numarasıdır —
    // eşleşmemeli (posAmount 0 kalmalı), Nakit'ten çalınmamalı.
    expect(parsed.posAmount).toBe(0);
    expect(parsed.cashAmount).toBe(300);
    expect(colMap.pos).toBe("—");
  });

  it("tam eşleşen kısa başlıkları (\"POS\", \"Kasa\") yine de yakalar", () => {
    const headers = ["Tarih", "POS", "Kasa", "Havale"];
    const row = ["01.11.2025", "1000", "200", "0"];
    const { row: parsed } = mapKasaRow(headers, row);
    expect(parsed.posAmount).toBe(1000);
    expect(parsed.cashAmount).toBe(200);
  });

  it("işlem/fiş bazlı bir Z-raporunda \"Kredi\" sütununu POS (kredi kartı) tutarı olarak yakalar", () => {
    const headers = ["İşlem Tarihi", "Nakit", "Kredi", "Havale", "Pos Z No"];
    const row = ["01.11.2025", "0", "1629", "0", "476"];
    const { row: parsed, colMap } = mapKasaRow(headers, row);
    // "Kredi" gerçek bir kredi kartı tutarı sütunudur — önceden hiçbir alana
    // eşleşmiyor, POS tutarı sessizce 0 kalıp ciro kayboluyordu (gerçek bir
    // kullanıcı dosyasında ₺15,6M'lik bir sütunün tamamen atlandığı tespit
    // edildi). "Pos Z No" ise hâlâ eşleşmemeli.
    expect(parsed.posAmount).toBe(1629);
    expect(colMap.pos).toBe("Kredi");
  });
});

describe("aggregateKasaRowsByDate", () => {
  const mk = (date: string, pos: number, cash: number, wire: number, notes?: string): ParsedKasaRow => ({
    registerDate: `${date}T00:00:00.000Z`, posAmount: pos, cashAmount: cash, wireAmount: wire, notes,
    rawDateValue: date, dateInvalid: false,
  });

  it("aynı güne ait birden fazla işlem satırını TEK bir günlük kayda toplar (kasa kapatma senaryosu)", () => {
    const rows = [
      mk("2025-11-01", 200, 0, 0),
      mk("2025-11-01", 0, 300, 0),
      mk("2025-11-01", 150, 0, 50),
      mk("2025-11-02", 1000, 200, 0),
    ];
    const result = aggregateKasaRowsByDate(rows);
    expect(result).toHaveLength(2);
    const day1 = result.find(r => r.registerDate.startsWith("2025-11-01"));
    expect(day1?.posAmount).toBe(350);
    expect(day1?.cashAmount).toBe(300);
    expect(day1?.wireAmount).toBe(50);
    const day2 = result.find(r => r.registerDate.startsWith("2025-11-02"));
    expect(day2?.posAmount).toBe(1000);
  });

  it("tek satırlık günleri olduğu gibi bırakır", () => {
    const rows = [mk("2025-11-01", 500, 100, 0)];
    const result = aggregateKasaRowsByDate(rows);
    expect(result).toHaveLength(1);
    expect(result[0].posAmount).toBe(500);
  });

  it("boş notu ilk dolu nottan doldurur, ikinci notu üzerine yazmaz", () => {
    const rows = [
      mk("2025-11-01", 100, 0, 0, undefined),
      mk("2025-11-01", 100, 0, 0, "İlk not"),
      mk("2025-11-01", 100, 0, 0, "İkinci not"),
    ];
    const result = aggregateKasaRowsByDate(rows);
    expect(result[0].notes).toBe("İlk not");
  });
});
