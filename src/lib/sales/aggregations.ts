/**
 * Satış Raporu sayfasına özgü, saf (side-effect'siz) toplulaştırma yardımcıları.
 * Bu dosya bilinçli olarak UI'dan bağımsızdır — hem sayfada hem testlerde
 * kolayca kullanılabilir.
 */

import type { ParsedSaleRow } from "./mapRow";

export interface StaffPerformance {
  staffName: string;
  totalRevenue: number;
  saleCount: number;
  prescriptionRevenue: number;
  retailRevenue: number;
  prescriptionPct: number; // reçeteli ciro yüzdesi (0-100)
}

/** Personel adına göre satışları toplulaştırır. `staffName` olmayan satırlar hariç tutulur. */
export function aggregateByStaff(records: Array<Pick<ParsedSaleRow, "staffName" | "netRevenue" | "saleType">>): StaffPerformance[] {
  const byStaff = new Map<string, { totalRevenue: number; saleCount: number; prescriptionRevenue: number; retailRevenue: number }>();
  for (const r of records) {
    const name = r.staffName?.trim();
    if (!name) continue;
    const cur = byStaff.get(name) ?? { totalRevenue: 0, saleCount: 0, prescriptionRevenue: 0, retailRevenue: 0 };
    cur.totalRevenue += r.netRevenue;
    cur.saleCount += 1;
    if (r.saleType === "PRESCRIPTION") cur.prescriptionRevenue += r.netRevenue;
    else cur.retailRevenue += r.netRevenue;
    byStaff.set(name, cur);
  }
  return Array.from(byStaff.entries())
    .map(([staffName, v]) => ({
      staffName,
      ...v,
      prescriptionPct: v.totalRevenue > 0 ? (v.prescriptionRevenue / v.totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

/** En az bir kayıtta anlamlı (boş olmayan) `staffName` var mı? */
export function hasStaffData(records: Array<Pick<ParsedSaleRow, "staffName">>): boolean {
  return records.some(r => !!r.staffName?.trim());
}

const DAY_NAMES_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Pazartesi ilk gün olacak şekilde sıralama (0=Pzt .. 6=Paz)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface DayOfWeekDensity {
  dayIndex: number; // 0=Pazar .. 6=Cumartesi (JS Date.getDay())
  label: string;
  totalRevenue: number;
  saleCount: number;
  avgRevenue: number; // gün başına ortalama ciro (o haftagünü kaç kez tekrarlandıysa ona göre)
}

/**
 * Haftanın günü bazında ortalama ciro yoğunluğu. `saleDate` "YYYY-MM-DD..." biçiminde
 * ISO string olmalı — yerel saat dilimi kaymasını önlemek için tarih parçası doğrudan
 * ayrıştırılır (bkz. sayfa içindeki `parseDateOnlyLocal`).
 */
export function aggregateByDayOfWeek(
  records: Array<Pick<ParsedSaleRow, "saleDate" | "netRevenue" | "saleType">>,
  lang: "tr" | "en" = "tr",
  saleTypeFilter?: "PRESCRIPTION" | "RETAIL",
): DayOfWeekDensity[] {
  const filtered = saleTypeFilter ? records.filter(r => r.saleType === saleTypeFilter) : records;
  const buckets = new Map<number, { totalRevenue: number; saleCount: number; distinctDates: Set<string> }>();
  for (const r of filtered) {
    const dateOnly = r.saleDate.slice(0, 10);
    const [y, m, d] = dateOnly.split("-").map(Number);
    if (!y || !m || !d) continue;
    const dayIndex = new Date(y, m - 1, d).getDay();
    const cur = buckets.get(dayIndex) ?? { totalRevenue: 0, saleCount: 0, distinctDates: new Set<string>() };
    cur.totalRevenue += r.netRevenue;
    cur.saleCount += 1;
    cur.distinctDates.add(dateOnly);
    buckets.set(dayIndex, cur);
  }
  const names = lang === "en" ? DAY_NAMES_EN : DAY_NAMES_TR;
  return DAY_ORDER.map(dayIndex => {
    const b = buckets.get(dayIndex);
    const totalRevenue = b?.totalRevenue ?? 0;
    const distinctCount = b?.distinctDates.size ?? 0;
    return {
      dayIndex,
      label: names[dayIndex],
      totalRevenue,
      saleCount: b?.saleCount ?? 0,
      avgRevenue: distinctCount > 0 ? totalRevenue / distinctCount : 0,
    };
  });
}

export interface PeriodTrendPoint {
  periodKey: string; // "YYYY-MM-DD" (hafta başlangıcı) veya "YYYY-MM"
  label: string;
  avgTicket: number; // ortalama fiş tutarı (netRevenue / işlem sayısı)
  avgDiscountRate: number; // ortalama iskonto oranı (0-100), yalnızca hesaplanabilir satırlar üzerinden
  transactionCount: number;
}

/** İskonto oranı (%). price*quantity 0 ise (ör. net-tutar modu) hesaplanamaz → null. */
export function discountRate(row: Pick<ParsedSaleRow, "price" | "quantity" | "discountAmount">): number | null {
  const base = row.price * row.quantity;
  if (base <= 0) return null;
  return (row.discountAmount / base) * 100;
}

function isoWeekStart(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const day = date.getDay(); // 0=Paz
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export interface TopProduct {
  productName: string;
  revenue: number;
  quantity: number;
}

/**
 * Ürün adına göre net geliri toplulaştırır ve en yüksek gelirli ilk `limit`
 * ürünü döner (azalan sırada). Dashboard'daki "Bu Ayın En Çok Satan Ürünleri"
 * gibi küçük/özet listeler için — tam Satış Raporu grafik setinin yerine
 * geçmez, sadece kısa bir üst-N özetidir.
 */
export function topProductsByRevenue(
  records: Array<Pick<ParsedSaleRow, "productName" | "netRevenue" | "quantity">>,
  limit = 5,
): TopProduct[] {
  const byProduct = new Map<string, { revenue: number; quantity: number }>();
  for (const r of records) {
    const name = r.productName?.trim();
    if (!name) continue;
    const cur = byProduct.get(name) ?? { revenue: 0, quantity: 0 };
    cur.revenue += r.netRevenue;
    cur.quantity += r.quantity;
    byProduct.set(name, cur);
  }
  return Array.from(byProduct.entries())
    .map(([productName, v]) => ({ productName, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

/**
 * Ortalama fiş tutarı ve iskonto oranı trendi. Veri aralığı 60 günden büyükse
 * aylık, değilse haftalık (ISO hafta başlangıcı — Pazartesi) gruplanır.
 */
export function aggregatePeriodTrend(
  records: Array<Pick<ParsedSaleRow, "saleDate" | "netRevenue" | "price" | "quantity" | "discountAmount">>,
): PeriodTrendPoint[] {
  if (records.length === 0) return [];

  const dates = records.map(r => r.saleDate.slice(0, 10)).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  const [fy, fm, fd] = first.split("-").map(Number);
  const [ly, lm, ld] = last.split("-").map(Number);
  const spanDays = Math.abs((new Date(ly, lm - 1, ld).getTime() - new Date(fy, fm - 1, fd).getTime())) / 86400000;
  const monthly = spanDays > 60;

  const buckets = new Map<string, { revenueSum: number; count: number; discountRateSum: number; discountRateCount: number }>();
  for (const r of records) {
    const dateOnly = r.saleDate.slice(0, 10);
    const key = monthly ? dateOnly.slice(0, 7) : isoWeekStart(dateOnly);
    const cur = buckets.get(key) ?? { revenueSum: 0, count: 0, discountRateSum: 0, discountRateCount: 0 };
    cur.revenueSum += r.netRevenue;
    cur.count += 1;
    const rate = discountRate(r);
    if (rate !== null) { cur.discountRateSum += rate; cur.discountRateCount += 1; }
    buckets.set(key, cur);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodKey, v]) => ({
      periodKey,
      label: monthly ? periodKey : periodKey,
      avgTicket: v.count > 0 ? v.revenueSum / v.count : 0,
      avgDiscountRate: v.discountRateCount > 0 ? v.discountRateSum / v.discountRateCount : 0,
      transactionCount: v.count,
    }));
}
