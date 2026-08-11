import { describe, it, expect } from "vitest";
import {
  todayRange,
  thisWeekRange,
  thisMonthRange,
  lastMonthRange,
  last7DaysRange,
  last30DaysRange,
  thisYearRange,
  matchPreset,
} from "./dateRanges";

describe("todayRange", () => {
  it("başlangıç ve bitiş aynı gün olur", () => {
    const now = new Date(2026, 7, 11); // 11 Ağustos 2026 (Salı)
    expect(todayRange(now)).toEqual({ start: "2026-08-11", end: "2026-08-11" });
  });
});

describe("thisWeekRange", () => {
  it("hafta Pazartesi başlar, Pazar biter (ayın ortasında bir gün için)", () => {
    const now = new Date(2026, 7, 11); // Salı, 11 Ağustos 2026
    expect(thisWeekRange(now)).toEqual({ start: "2026-08-10", end: "2026-08-16" });
  });

  it("Pazartesi gününün kendisi haftanın ilk günü olur", () => {
    const now = new Date(2026, 7, 10); // Pazartesi
    expect(thisWeekRange(now)).toEqual({ start: "2026-08-10", end: "2026-08-16" });
  });

  it("Pazar günü haftanın son günü olur", () => {
    const now = new Date(2026, 7, 16); // Pazar
    expect(thisWeekRange(now)).toEqual({ start: "2026-08-10", end: "2026-08-16" });
  });
});

describe("thisMonthRange", () => {
  it("ayın ortasındaki bir gün için ayın ilk ve son gününü döndürür", () => {
    const now = new Date(2026, 7, 15); // 15 Ağustos 2026
    expect(thisMonthRange(now)).toEqual({ start: "2026-08-01", end: "2026-08-31" });
  });
});

describe("lastMonthRange", () => {
  it("normal ay geçişinde bir önceki ayı döndürür", () => {
    const now = new Date(2026, 7, 15); // Ağustos 2026
    expect(lastMonthRange(now)).toEqual({ start: "2026-07-01", end: "2026-07-31" });
  });

  it("yıl sınırını geçerken bir önceki yılın Aralık ayını döndürür", () => {
    const now = new Date(2026, 0, 15); // Ocak 2026
    expect(lastMonthRange(now)).toEqual({ start: "2025-12-01", end: "2025-12-31" });
  });
});

describe("last7DaysRange", () => {
  it("bugünü de dahil ederek 7 gün geriye gider", () => {
    const now = new Date(2026, 7, 11); // 11 Ağustos 2026
    expect(last7DaysRange(now)).toEqual({ start: "2026-08-05", end: "2026-08-11" });
  });
});

describe("last30DaysRange", () => {
  it("bugünü de dahil ederek 30 gün geriye gider", () => {
    const now = new Date(2026, 7, 11); // 11 Ağustos 2026
    expect(last30DaysRange(now)).toEqual({ start: "2026-07-13", end: "2026-08-11" });
  });
});

describe("thisYearRange", () => {
  it("yılın 1 Ocak - 31 Aralık aralığını döndürür", () => {
    const now = new Date(2026, 7, 11);
    expect(thisYearRange(now)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
});

describe("matchPreset", () => {
  it("uygulanan aralık bir preset ile tam eşleşiyorsa preset anahtarını döndürür", () => {
    const now = new Date(2026, 7, 11);
    expect(matchPreset("2026-08-01", "2026-08-31", now)).toBe("thisMonth");
    expect(matchPreset("2026-08-11", "2026-08-11", now)).toBe("today");
  });

  it("özel/manuel bir aralık hiçbir preset ile eşleşmezse null döndürür", () => {
    const now = new Date(2026, 7, 11);
    expect(matchPreset("2026-08-03", "2026-08-09", now)).toBeNull();
  });
});
