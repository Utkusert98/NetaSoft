import { describe, it, expect } from "vitest";
import { getHolidaysForYear, countHolidaysInRange } from "./turkishHolidays";

describe("getHolidaysForYear — sabit resmi tatiller", () => {
  it("2026 için tüm sabit tatilleri doğru tarihte içerir", () => {
    const holidays = getHolidaysForYear(2026).map(h => h.date);
    expect(holidays).toContain("2026-01-01");
    expect(holidays).toContain("2026-04-23");
    expect(holidays).toContain("2026-05-01");
    expect(holidays).toContain("2026-05-19");
    expect(holidays).toContain("2026-07-15");
    expect(holidays).toContain("2026-08-30");
    expect(holidays).toContain("2026-10-29");
  });

  it("bilinen bir yıl için dini bayram günlerini de içerir", () => {
    const holidays = getHolidaysForYear(2026).map(h => h.date);
    expect(holidays).toContain("2026-03-20");
    expect(holidays).toContain("2026-05-27");
  });

  it("tablo dışı bir yıl için sadece sabit tatilleri döner (dini bayram olmadan patlamaz)", () => {
    const holidays = getHolidaysForYear(2031);
    expect(holidays.length).toBe(7);
  });
});

describe("countHolidaysInRange", () => {
  it("Ağustos 2026'nın kalan günlerinde (12-31 Ağustos) tam olarak 1 resmi tatil (30 Ağustos) sayar", () => {
    const start = new Date("2026-08-12T00:00:00.000Z");
    const end = new Date("2026-08-31T23:59:59.999Z");
    expect(countHolidaysInRange(start, end)).toBe(1);
  });

  it("başlangıç bitişten sonraysa 0 döner", () => {
    const start = new Date("2026-08-31T00:00:00.000Z");
    const end = new Date("2026-08-01T00:00:00.000Z");
    expect(countHolidaysInRange(start, end)).toBe(0);
  });

  it("hiç tatil içermeyen bir aralıkta 0 döner", () => {
    const start = new Date("2026-08-01T00:00:00.000Z");
    const end = new Date("2026-08-05T00:00:00.000Z");
    expect(countHolidaysInRange(start, end)).toBe(0);
  });

  it("yıl sınırını aşan bir aralıkta iki yılın tatillerini de doğru sayar", () => {
    // 2025-12-28 .. 2026-01-03: sadece 2026-01-01 (Yılbaşı) tatil
    const start = new Date("2025-12-28T00:00:00.000Z");
    const end = new Date("2026-01-03T00:00:00.000Z");
    expect(countHolidaysInRange(start, end)).toBe(1);
  });
});
