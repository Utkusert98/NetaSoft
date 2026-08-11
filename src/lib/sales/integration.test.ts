import { describe, it, expect } from "vitest";
import { parseSalesFileClient, isClientParseable } from "./parseFile";
import { mapRow, isColumnMapConfident } from "./mapRow";

// Dosya → ayrıştırma → kolon eşleştirme → hesaplama zincirinin uçtan uca
// (parseFile.ts + mapRow.ts birlikte) doğru çalıştığını doğrular. Birim
// testleri her modülü ayrı ayrı kapsar ama gerçek bir CSV metninin
// tarayıcı-tarzı File nesnesinden geçip doğru toplamlara ulaşması ayrıca
// test edilmemişti.
describe("Satış dosyası entegrasyon testi — CSV → parse → mapRow", () => {
  it("gerçekçi bir işlem/fiş bazlı CSV dosyasını uçtan uca doğru işler", async () => {
    const csv = [
      "İşlem No;Cari Adı;İşlem Tipi;Tarih;Toplam Tutar;İskonto Tutar;Net Tutar;Personel",
      "21147;PERAKENDE MÜŞTERİ;P.SATIŞ (K.K.);01/07/2026;508.87;0.00;508.87;Havan Soft",
      "21149;NAZİK YERŞEN;REÇETELİ SATIŞ;01/07/2026;24010.08;0.00;24010.08;Havan Soft",
      "21159;PERAKENDE MÜŞTERİ;P. SATIŞ;01/07/2026;152.62;2.62;150.00;KASA",
    ].join("\n");

    const file = new File([csv], "satis.csv", { type: "text/csv" });
    expect(isClientParseable(file.name)).toBe(true);

    const { headers, dataRows } = await parseSalesFileClient(file);
    expect(headers).toEqual(["İşlem No", "Cari Adı", "İşlem Tipi", "Tarih", "Toplam Tutar", "İskonto Tutar", "Net Tutar", "Personel"]);
    expect(dataRows).toHaveLength(3);

    const mapped = dataRows.map((row) => mapRow(headers, row, {}));

    // Kolon eşleştirmesi manuel müdahale gerektirmeden güvenilir olmalı
    for (const { colMap } of mapped) {
      expect(isColumnMapConfident(colMap)).toBe(true);
    }

    const [retail1, prescription, retail2] = mapped.map((m) => m.row);
    expect(retail1.saleType).toBe("RETAIL");
    expect(prescription.saleType).toBe("PRESCRIPTION");
    expect(prescription.netRevenue).toBeCloseTo(24010.08, 2);
    // İskonto Tutar ayrı sütun olsa da Net Tutar zaten nihai tutardır — çift düşülmemeli
    expect(retail2.netRevenue).toBeCloseTo(150.0, 2);

    const total = mapped.reduce((sum, m) => sum + m.row.netRevenue, 0);
    expect(total).toBeCloseTo(508.87 + 24010.08 + 150.0, 2);
  });

  it("boş satır dışında sadece başlık olan bir CSV'yi anlamlı bir hatayla reddeder", async () => {
    const file = new File(["İşlem No;Tarih;Net Tutar"], "bos.csv", { type: "text/csv" });
    await expect(parseSalesFileClient(file)).rejects.toThrow("CSV boş veya geçersiz");
  });
});
