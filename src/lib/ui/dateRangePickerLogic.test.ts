import { describe, it, expect } from "vitest";
import { buildMonthGrid, nextRangeSelection, isInRange, isInHoverPreview } from "./dateRangePickerLogic";

describe("buildMonthGrid — takvim grid üretimi", () => {
  it("42 gün (6 hafta) döner, hafta Pazartesi'den başlar", () => {
    const days = buildMonthGrid(2026, 7); // Ağustos 2026 (0-index)
    expect(days.length).toBe(42);
    // 01.08.2026 bir Cumartesi'dir — grid Pazartesi (27.07.2026) ile başlamalı.
    expect(days[0].dateStr).toBe("2026-07-27");
    expect(days[0].inMonth).toBe(false);
  });

  it("ayın kendi günleri inMonth=true olarak işaretlenir", () => {
    const days = buildMonthGrid(2026, 7);
    const aug1 = days.find(d => d.dateStr === "2026-08-01");
    expect(aug1?.inMonth).toBe(true);
    const aug31 = days.find(d => d.dateStr === "2026-08-31");
    expect(aug31?.inMonth).toBe(true);
  });

  it("bugünün tarihi isToday=true olarak işaretlenir", () => {
    const today = new Date(2026, 7, 11); // 11 Ağustos 2026
    const days = buildMonthGrid(2026, 7, today);
    const todayCell = days.find(d => d.dateStr === "2026-08-11");
    expect(todayCell?.isToday).toBe(true);
    expect(days.filter(d => d.isToday).length).toBe(1);
  });
});

describe("nextRangeSelection — aralık seçim durum makinesi", () => {
  it("boş seçimde ilk tıklama start olur, end null kalır", () => {
    const next = nextRangeSelection({ start: null, end: null }, "2026-07-01");
    expect(next).toEqual({ start: "2026-07-01", end: null });
  });

  it("start seçiliyken, sonraki bir güne tıklama end olur", () => {
    const next = nextRangeSelection({ start: "2026-07-01", end: null }, "2026-07-15");
    expect(next).toEqual({ start: "2026-07-01", end: "2026-07-15" });
  });

  it("start seçiliyken, ÖNCEKİ bir güne tıklama start/end yer değiştirir", () => {
    const next = nextRangeSelection({ start: "2026-07-15", end: null }, "2026-07-01");
    expect(next).toEqual({ start: "2026-07-01", end: "2026-07-15" });
  });

  it("start seçiliyken aynı güne tekrar tıklama tek günlük aralık oluşturur", () => {
    const next = nextRangeSelection({ start: "2026-07-01", end: null }, "2026-07-01");
    expect(next).toEqual({ start: "2026-07-01", end: "2026-07-01" });
  });

  it("tam bir aralık varken yeni tıklama YENİ bir aralık başlatır (eskiyi sıfırlar)", () => {
    const next = nextRangeSelection({ start: "2026-07-01", end: "2026-07-15" }, "2026-08-01");
    expect(next).toEqual({ start: "2026-08-01", end: null });
  });
});

describe("isInRange / isInHoverPreview", () => {
  it("isInRange yalnızca start VE end doluyken ve aralık içindeyken true döner", () => {
    expect(isInRange("2026-07-10", "2026-07-01", "2026-07-15")).toBe(true);
    expect(isInRange("2026-06-30", "2026-07-01", "2026-07-15")).toBe(false);
    expect(isInRange("2026-07-10", "2026-07-01", null)).toBe(false);
  });

  it("isInHoverPreview yalnızca start seçili VE end henüz seçilmemişken önizleme aralığını hesaplar", () => {
    expect(isInHoverPreview("2026-07-10", "2026-07-01", null, "2026-07-15")).toBe(true);
    // hover, start'tan önceyse aralık ters çevrilir
    expect(isInHoverPreview("2026-06-20", "2026-07-01", null, "2026-06-15")).toBe(true);
    // end zaten seçiliyse önizleme uygulanmaz (tamamlanmış aralık isInRange ile gösterilir)
    expect(isInHoverPreview("2026-07-10", "2026-07-01", "2026-07-15", "2026-07-20")).toBe(false);
  });
});
