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
  saleRowsDateSpan,
  dayRangeToUtcBounds,
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

describe("saleRowsDateSpan", () => {
  it("satırların saleDate alanlarından en küçük/en büyük tarihi döndürür", () => {
    const rows = [
      { saleDate: "2026-07-15T00:00:00.000Z" },
      { saleDate: "2026-07-03T00:00:00.000Z" },
      { saleDate: "2026-07-28T00:00:00.000Z" },
    ];
    expect(saleRowsDateSpan(rows)).toEqual({ start: "2026-07-03", end: "2026-07-28" });
  });

  it("düz YYYY-MM-DD biçimindeki tarihlerle de çalışır", () => {
    const rows = [{ saleDate: "2026-01-05" }, { saleDate: "2026-01-01" }];
    expect(saleRowsDateSpan(rows)).toEqual({ start: "2026-01-01", end: "2026-01-05" });
  });

  it("boş dizi için null döndürür", () => {
    expect(saleRowsDateSpan([])).toBeNull();
  });

  it("tek satırlı dizide start ve end aynı olur", () => {
    expect(saleRowsDateSpan([{ saleDate: "2026-03-10T12:00:00.000Z" }])).toEqual({ start: "2026-03-10", end: "2026-03-10" });
  });
});

describe("dayRangeToUtcBounds", () => {
  it("YYYY-MM-DD çiftini o günlerin TAMAMINI kapsayan UTC sınırlarına çevirir", () => {
    const bounds = dayRangeToUtcBounds("2026-08-01", "2026-08-11");
    expect(bounds).not.toBeNull();
    expect(bounds!.start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(bounds!.end.toISOString()).toBe("2026-08-11T23:59:59.999Z");
  });

  it("tarih+saat içeren (ISO datetime) girdilerin yalnızca tarih kısmını kullanır", () => {
    const bounds = dayRangeToUtcBounds("2026-08-01T15:30:00.000Z", "2026-08-11T09:00:00.000Z");
    expect(bounds!.start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(bounds!.end.toISOString()).toBe("2026-08-11T23:59:59.999Z");
  });

  it("tek günlük (start === end) bir aralık için de doğru sınırları döndürür", () => {
    const bounds = dayRangeToUtcBounds("2026-08-05", "2026-08-05");
    expect(bounds!.start.toISOString()).toBe("2026-08-05T00:00:00.000Z");
    expect(bounds!.end.toISOString()).toBe("2026-08-05T23:59:59.999Z");
  });

  it("ayrıştırılamayan bir tarih verilirse null döner", () => {
    expect(dayRangeToUtcBounds("not-a-date", "2026-08-11")).toBeNull();
    expect(dayRangeToUtcBounds("2026-08-01", "also-not-a-date")).toBeNull();
    expect(dayRangeToUtcBounds("", "")).toBeNull();
  });
});
