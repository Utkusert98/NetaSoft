/**
 * Türkiye resmi tatilleri — AI asistanının "ay sonu ciro tahmini" hesabında
 * kalan çalışma günü sayısını doğru bulabilmesi için kullanılır.
 *
 * Sabit (miladi takvime göre) resmi tatiller her yıl aynı tarihte, kesin
 * olarak hesaplanabilir. Dini bayramlar (Ramazan/Kurban Bayramı) ise Hicri
 * takvime göre belirlenir ve Diyanet İşleri Başkanlığı'nın açıkladığı
 * tarihler ay gözlemine bağlı olarak ±1 gün kayabilir — bu yüzden aşağıdaki
 * tarihler Diyanet'in yayımladığı resmi takvime göre GİRİLMİŞ, canlı
 * hesaplanmamıştır (Hicri-Miladi dönüşümü astronomik hesap gerektirir).
 * Yalnızca tabloda yer alan yıllar için doğru sonuç verir.
 */

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

const FIXED_HOLIDAYS_MD: Array<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: "Yılbaşı" },
  { month: 4, day: 23, name: "Ulusal Egemenlik ve Çocuk Bayramı" },
  { month: 5, day: 1, name: "Emek ve Dayanışma Günü" },
  { month: 5, day: 19, name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı" },
  { month: 7, day: 15, name: "Demokrasi ve Millî Birlik Günü" },
  { month: 8, day: 30, name: "Zafer Bayramı" },
  { month: 10, day: 29, name: "Cumhuriyet Bayramı" },
];

// Ramazan Bayramı ve Kurban Bayramı — arefe günü dahil, Diyanet'in
// yayımladığı resmi tatil aralıkları (yalnızca listelenen yıllar için).
const MOVABLE_HOLIDAY_RANGES: Record<number, Array<{ start: string; end: string; name: string }>> = {
  2024: [
    { start: "2024-04-09", end: "2024-04-11", name: "Ramazan Bayramı" },
    { start: "2024-06-15", end: "2024-06-18", name: "Kurban Bayramı" },
  ],
  2025: [
    { start: "2025-03-29", end: "2025-03-31", name: "Ramazan Bayramı" },
    { start: "2025-06-05", end: "2025-06-08", name: "Kurban Bayramı" },
  ],
  2026: [
    { start: "2026-03-19", end: "2026-03-21", name: "Ramazan Bayramı" },
    { start: "2026-05-26", end: "2026-05-29", name: "Kurban Bayramı" },
  ],
  2027: [
    { start: "2027-03-08", end: "2027-03-10", name: "Ramazan Bayramı" },
    { start: "2027-05-15", end: "2027-05-18", name: "Kurban Bayramı" },
  ],
};

function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Bir takvim yılı için tüm resmi tatillerin (sabit + bilinen dini bayram) listesini döner. */
export function getHolidaysForYear(year: number): Holiday[] {
  const holidays: Holiday[] = FIXED_HOLIDAYS_MD.map(h => ({
    date: `${year}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`,
    name: h.name,
  }));

  const movable = MOVABLE_HOLIDAY_RANGES[year] ?? [];
  for (const range of movable) {
    const start = new Date(`${range.start}T00:00:00.000Z`);
    const end = new Date(`${range.end}T00:00:00.000Z`);
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      holidays.push({ date: toDateKey(d), name: range.name });
    }
  }
  return holidays;
}

/** Verilen (dahil) tarih aralığındaki resmi tatil GÜN SAYISINI döner. */
export function countHolidaysInRange(start: Date, end: Date): number {
  if (start > end) return 0;
  const years = new Set<number>();
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) years.add(y);

  const holidayDates = new Set<string>();
  for (const y of years) {
    for (const h of getHolidaysForYear(y)) holidayDates.add(h.date);
  }

  let count = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (holidayDates.has(toDateKey(d))) count++;
  }
  return count;
}

/**
 * Verilen (dahil) tarih aralığındaki KAPALI GÜN sayısını döner: resmi
 * tatiller ile Pazar günlerinin BİRLEŞİMİ (aynı güne denk gelirlerse tekrar
 * sayılmaz). Eczane haftada 6 gün çalışıyor, Pazar günleri nöbetçi olmadığı
 * sürece kapalı — bu yüzden ay sonu ciro tahmininde kalan çalışma günü
 * hesabı yalnızca resmi tatilleri değil Pazar günlerini de düşmeli.
 */
export function countClosedDaysInRange(start: Date, end: Date): number {
  if (start > end) return 0;
  const years = new Set<number>();
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) years.add(y);

  const holidayDates = new Set<string>();
  for (const y of years) {
    for (const h of getHolidaysForYear(y)) holidayDates.add(h.date);
  }

  let count = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const isSunday = d.getUTCDay() === 0;
    if (isSunday || holidayDates.has(toDateKey(d))) count++;
  }
  return count;
}
