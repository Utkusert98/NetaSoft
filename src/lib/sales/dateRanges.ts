// Satış Raporları sayfasındaki hızlı tarih aralığı ("preset") butonları için
// saf yardımcı fonksiyonlar. Tüm hesaplamalar YEREL tarih bileşenleri
// üzerinden yapılır (UTC dönüşümü YOK) — bu yüzden tarayıcı saat dilimi
// farklarından kaynaklanan "bir gün kayması" (off-by-one) sorunu oluşmaz.
//
// Hafta başlangıcı: PAZARTESİ (Türkiye/ISO-8601 konvansiyonu).

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDays = (d: Date, days: number): Date => {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
};

/** Pazartesi=0 ... Pazar=6 olacak şekilde haftanın gününü döndürür (JS'in
 * varsayılan Pazar=0 sırasını Türkiye konvansiyonuna çevirir). */
const mondayIndex = (d: Date): number => (d.getDay() + 6) % 7;

export function todayRange(now: Date = new Date()): DateRange {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start: toDateStr(d), end: toDateStr(d) };
}

export function thisWeekRange(now: Date = new Date()): DateRange {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monday = addDays(d, -mondayIndex(d));
  const sunday = addDays(monday, 6);
  return { start: toDateStr(monday), end: toDateStr(sunday) };
}

export function thisMonthRange(now: Date = new Date()): DateRange {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toDateStr(start), end: toDateStr(end) };
}

export function lastMonthRange(now: Date = new Date()): DateRange {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: toDateStr(start), end: toDateStr(end) };
}

export function last7DaysRange(now: Date = new Date()): DateRange {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start: toDateStr(addDays(d, -6)), end: toDateStr(d) };
}

export function last30DaysRange(now: Date = new Date()): DateRange {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start: toDateStr(addDays(d, -29)), end: toDateStr(d) };
}

export function thisYearRange(now: Date = new Date()): DateRange {
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31);
  return { start: toDateStr(start), end: toDateStr(end) };
}

export type PresetKey = "today" | "thisWeek" | "thisMonth" | "lastMonth" | "last7" | "last30" | "thisYear";

export interface PresetDef {
  key: PresetKey;
  labelTr: string;
  labelEn: string;
  range: (now?: Date) => DateRange;
}

export const DATE_RANGE_PRESETS: PresetDef[] = [
  { key: "today", labelTr: "Bugün", labelEn: "Today", range: todayRange },
  { key: "thisWeek", labelTr: "Bu Hafta", labelEn: "This Week", range: thisWeekRange },
  { key: "thisMonth", labelTr: "Bu Ay", labelEn: "This Month", range: thisMonthRange },
  { key: "lastMonth", labelTr: "Geçen Ay", labelEn: "Last Month", range: lastMonthRange },
  { key: "last7", labelTr: "Son 7 Gün", labelEn: "Last 7 Days", range: last7DaysRange },
  { key: "last30", labelTr: "Son 30 Gün", labelEn: "Last 30 Days", range: last30DaysRange },
  { key: "thisYear", labelTr: "Bu Yıl", labelEn: "This Year", range: thisYearRange },
];

/** Verilen (uygulanmış) start/end çiftinin hangi preset'e tam olarak denk
 * geldiğini döndürür; hiçbiri eşleşmiyorsa (özel/manuel aralık) null döner. */
export function matchPreset(start: string, end: string, now: Date = new Date()): PresetKey | null {
  for (const preset of DATE_RANGE_PRESETS) {
    const r = preset.range(now);
    if (r.start === start && r.end === end) return preset.key;
  }
  return null;
}

/**
 * Ayrıştırılmış (parse edilmiş) satış satırlarının `saleDate` alanları
 * üzerinden en küçük/en büyük tarihi (YYYY-MM-DD) hesaplar. Hem dosya
 * ÖNİZLEME aşamasında (kayıt henüz yapılmadan) hem de KAYIT sonrasında
 * filtre aralığını dosyanın gerçek tarih aralığına göre ayarlamak için
 * kullanılan tek, paylaşılan (DRY) saf fonksiyon.
 *
 * `saleDate` alanı `"YYYY-MM-DD"` veya `"YYYY-MM-DDTHH:mm:ss.sssZ"` biçiminde
 * olabilir — yalnızca ilk 10 karakter (tarih kısmı) kullanılır. Boş dizi için
 * `null` döner.
 */
export function saleRowsDateSpan(rows: Array<{ saleDate: string }>): DateRange | null {
  if (rows.length === 0) return null;
  const days = rows.map(r => r.saleDate.slice(0, 10)).sort();
  return { start: days[0], end: days[days.length - 1] };
}
