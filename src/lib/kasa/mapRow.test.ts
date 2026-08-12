import { describe, it, expect } from "vitest";
import { mapKasaRow } from "./mapRow";

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
});
