export type RecurringFrequency = "MONTHLY" | "YEARLY" | "DAILY";

// Tek bir seferde üretilebilecek üst sınır — sınırsız bir tarih aralığının
// (ör. yanlışlıkla "günlük" seçilip 10 yıllık aralık verilmesi) sunucuyu ve
// veritabanını aşırı yüklemesini önler.
export const MAX_RECURRING_DATES = 500;

function toUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastDayOfUtcMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/**
 * Başlangıç/bitiş tarihi ve sıklığa göre "Düzenli Ödeme" için oluşturulacak
 * tüm tarihleri (YYYY-MM-DD) üretir. Ayın son gününden başlayan aylık/yıllık
 * seriler, hedef ayda o gün yoksa (ör. 31'i olmayan ay) o ayın son gününe
 * sabitlenir — gün asla bir sonraki aya taşmaz.
 */
export function generateRecurringDates(
  startDateStr: string,
  endDateStr: string,
  frequency: RecurringFrequency
): string[] {
  const start = toUtcDate(startDateStr);
  const end = toUtcDate(endDateStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (start.getTime() > end.getTime()) return [];

  const dates: string[] = [];
  const targetDay = start.getUTCDate();

  if (frequency === "DAILY") {
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime() && dates.length <= MAX_RECURRING_DATES) {
      dates.push(toDateKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }

  if (frequency === "MONTHLY") {
    let year = start.getUTCFullYear();
    let monthIndex0 = start.getUTCMonth();
    while (dates.length <= MAX_RECURRING_DATES) {
      const day = Math.min(targetDay, lastDayOfUtcMonth(year, monthIndex0));
      const candidate = new Date(Date.UTC(year, monthIndex0, day));
      if (candidate.getTime() > end.getTime()) break;
      dates.push(toDateKey(candidate));
      monthIndex0 += 1;
      if (monthIndex0 > 11) { monthIndex0 = 0; year += 1; }
    }
    return dates;
  }

  // YEARLY
  const targetMonth0 = start.getUTCMonth();
  let year = start.getUTCFullYear();
  while (dates.length <= MAX_RECURRING_DATES) {
    const day = Math.min(targetDay, lastDayOfUtcMonth(year, targetMonth0));
    const candidate = new Date(Date.UTC(year, targetMonth0, day));
    if (candidate.getTime() > end.getTime()) break;
    dates.push(toDateKey(candidate));
    year += 1;
  }
  return dates;
}
