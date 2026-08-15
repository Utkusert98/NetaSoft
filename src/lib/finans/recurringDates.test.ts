import { describe, it, expect } from "vitest";
import { generateRecurringDates, MAX_RECURRING_DATES } from "./recurringDates";

describe("generateRecurringDates", () => {
  it("aylık: kira gibi 1 yıllık sözleşmede 12 ay üretir", () => {
    const dates = generateRecurringDates("2025-11-05", "2026-10-05", "MONTHLY");
    expect(dates).toHaveLength(12);
    expect(dates[0]).toBe("2025-11-05");
    expect(dates[dates.length - 1]).toBe("2026-10-05");
  });

  it("aylık: 31'i olmayan aylarda güne değil ayın son gününe sabitlenir", () => {
    const dates = generateRecurringDates("2026-01-31", "2026-04-30", "MONTHLY");
    expect(dates).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("yıllık: aynı gün/ay üzerinden yıl yıl üretir", () => {
    const dates = generateRecurringDates("2025-06-15", "2028-06-15", "YEARLY");
    expect(dates).toEqual(["2025-06-15", "2026-06-15", "2027-06-15", "2028-06-15"]);
  });

  it("yıllık: 29 Şubat başlangıcı artık olmayan yılda 28 Şubat'a sabitlenir", () => {
    const dates = generateRecurringDates("2028-02-29", "2030-02-28", "YEARLY");
    expect(dates).toEqual(["2028-02-29", "2029-02-28", "2030-02-28"]);
  });

  it("günlük: her günü tek tek üretir", () => {
    const dates = generateRecurringDates("2026-03-01", "2026-03-05", "DAILY");
    expect(dates).toEqual(["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05"]);
  });

  it("bitiş tarihi başlangıçtan önceyse boş dizi döner", () => {
    expect(generateRecurringDates("2026-05-01", "2026-04-01", "MONTHLY")).toEqual([]);
  });

  it("başlangıç = bitiş ise tek tarih döner", () => {
    expect(generateRecurringDates("2026-05-01", "2026-05-01", "MONTHLY")).toEqual(["2026-05-01"]);
  });

  it("aşırı uzun bir aralık MAX_RECURRING_DATES üzerine taşarak tespit edilebilir", () => {
    const dates = generateRecurringDates("2000-01-01", "2030-01-01", "DAILY");
    expect(dates.length).toBeGreaterThan(MAX_RECURRING_DATES);
  });
});
