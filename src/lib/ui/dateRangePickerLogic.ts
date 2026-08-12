/**
 * `DateRangePicker` bileşeninin saf (pure), test edilebilir mantığı — takvim
 * grid'i üretimi ve aralık seçim durum makinesi. Bileşenden ayrı tutulur ki
 * DOM/React olmadan birim testleri yazılabilsin.
 */

export interface CalendarDay {
  dateStr: string; // YYYY-MM-DD
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Pazartesi=0 ... Pazar=6 (Türkiye/ISO-8601 konvansiyonu — hafta Pazartesi başlar). */
const mondayIndex = (d: Date): number => (d.getDay() + 6) % 7;

export const TR_DAY_HEADERS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
export const EN_DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const TR_MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
export const EN_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Belirli bir ay için 6 haftalık (42 günlük), önceki/sonraki aydan taşan
 * günleri de içeren tam bir takvim grid'i üretir — sabit yükseklikte,
 * sıçramasız bir takvim görünümü için.
 */
export function buildMonthGrid(year: number, monthIndex: number, today: Date = new Date()): CalendarDay[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const startOffset = mondayIndex(firstOfMonth);
  const gridStart = new Date(year, monthIndex, 1 - startOffset);
  const todayStr = toDateStr(today);

  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    days.push({
      dateStr: toDateStr(d),
      day: d.getDate(),
      inMonth: d.getMonth() === monthIndex,
      isToday: toDateStr(d) === todayStr,
    });
  }
  return days;
}

export interface RangeSelection {
  start: string | null;
  end: string | null;
}

/**
 * Bir gün tıklamasının aralık seçimini nasıl değiştirdiğini belirleyen saf
 * durum makinesi:
 * - Seçim boşsa veya zaten tam bir aralık (start+end) varsa: yeni bir aralık
 *   başlatılır (start=tıklanan, end=null).
 * - Yalnızca start varsa: tıklanan gün start'tan önceyse start/end yer
 *   değiştirir (kullanıcı ters sırada tıklamış olabilir), sonraysa end olur.
 */
export function nextRangeSelection(current: RangeSelection, clickedDateStr: string): RangeSelection {
  if (!current.start || (current.start && current.end)) {
    return { start: clickedDateStr, end: null };
  }
  // Yalnızca start var
  if (clickedDateStr < current.start) {
    return { start: clickedDateStr, end: current.start };
  }
  if (clickedDateStr === current.start) {
    // Aynı güne tekrar tıklama — tek günlük aralık.
    return { start: clickedDateStr, end: clickedDateStr };
  }
  return { start: current.start, end: clickedDateStr };
}

/** Bir günün, seçilmiş (tamamlanmış) aralığın içinde olup olmadığını döndürür. */
export function isInRange(dateStr: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  return dateStr >= start && dateStr <= end;
}

/** Bir günün, henüz tamamlanmamış (yalnızca start seçili) bir aralıkta,
 *  fare/hover ile önizlenen aralığın içinde olup olmadığını döndürür. */
export function isInHoverPreview(dateStr: string, start: string | null, end: string | null, hoverDateStr: string | null): boolean {
  if (!start || end || !hoverDateStr) return false;
  const lo = hoverDateStr < start ? hoverDateStr : start;
  const hi = hoverDateStr < start ? start : hoverDateStr;
  return dateStr >= lo && dateStr <= hi;
}

/**
 * `SingleDatePicker` için saf seçim mantığı — tıklanan gün doğrudan tek
 * seçili tarih olur (aralık durum makinesi gerekmez).
 */
export function nextSingleDateSelection(clickedDateStr: string): string {
  return clickedDateStr;
}

/** Bir günün, tek seçili tarihe (SingleDatePicker) eşit olup olmadığını döndürür. */
export function isSameDate(dateStr: string, selected: string | null): boolean {
  if (!selected) return false;
  return dateStr === selected;
}
