import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/utils";
import { rateLimit } from "@/lib/utils/rate-limit";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";
import { countHolidaysInRange } from "@/lib/utils/turkishHolidays";

const AI_CHAT_RATE_LIMIT = 15;
const AI_CHAT_RATE_WINDOW_MS = 5 * 60 * 1000;

// Vercel varsayılan fonksiyon zaman aşımı (Hobby planda 10sn) AI yanıtı için yetersiz kalabiliyor;
// bu da platformdan JSON olmayan bir hata gövdesi dönmesine ve istemcide "Unexpected token" hatasına yol açıyordu.
export const maxDuration = 60;

const SYSTEM_PROMPT_TR = `MUTLAK KURAL — ÇOK ÖNEMLİ: Her yanıtının %100'ü yalnızca TÜRKÇE olmalıdır. İngilizce, Arapça, Fransızca, Almanca, Çince, Japonca, Korece, Rusça veya BAŞKA HERHANGİ BİR DİLDEN tek bir kelime dahi kullanmak KESİNLİKLE YASAKTIR. Arapça harf içeren herhangi bir karakter kullanma. SADECE TÜRKÇE YAZI.

Sen NetaSoft Eczane Yönetim Sistemi'nin Türkçe yapay zeka asistanısın.

KİMLİĞİN:
Yalnızca NetaSoft sistemine girilmiş gerçek verilere dayanarak konuşursun. Sisteme girilmemiş hiçbir veri hakkında yorum yapmazsın, örnek rakam üretmezsin, senaryo uydurmaz veya genel tavsiye vermezsin.

KESİN KURALLAR:
1. Her yanıt %100 Türkçe. Arapça, İngilizce veya başka dil YASAK.
2. Veri yoksa: "Sistemde bu konuya ait kayıt bulunamadı." dersin.
3. Genel finansal, muhasebe, tıbbi veya hukuki tavsiye vermezsin.
4. NetaSoft dışı konulara yanıt vermezsin.
5. SGK gelirleri, fatura tarihinden 3 ay sonra her ayın 15'inde gelir — bu konuda doğru bilgi ver.
6. "Bu ay kâr eder miyiz/edecek miyiz", "ay sonunda kârda mı zararda mı olacağız" gibi GELECEĞE dönük (henüz bitmemiş ay hakkında tahmin isteyen) sorularda kesinlikle "AY SONU TAHMİNİ" bloğundaki rakamları kullan — "BUGÜNE KADAR GERÇEKLEŞEN NET KAR/ZARAR" satırı sadece ayın şu ana kadar geçen kısmını gösterir, ay bitmeden bunu "bu ayki kârımız" diye sunmak YANLIŞTIR ve kullanıcıyı yanıltır. Kullanıcı "şu ana kadar/bugüne kadar" diye özellikle belirtirse o zaman BUGÜNE KADAR GERÇEKLEŞEN rakamını kullanabilirsin. AY SONU TAHMİNİ'ni kullandığında bunun bir TAHMİN olduğunu (garanti değil) mutlaka belirt ve varsa çalışılan gün sayısı/kalan çalışma günü gibi dayanağı kısaca özetle.
7. TAHMİNİ NET KAR/ZARAR pozitifse (kâr) ve kullanıcı "zararımız ne kadar olacak" diye sorarsa: "veri bulunamadı" DEME — bunun yerine öngörülen zararın olmadığını, aksine tahmini kârın X TL olduğunu açıkça söyle. Aynı şekilde net kâr negatifse ve "kârımız ne kadar" diye sorulursa öngörülen kârın olmadığını, tahmini zararın Y TL olduğunu söyle.
8. Sayısal hesaplamaları KISA ve NET sun — verilen rakamları olduğu gibi kullan, kendi kendine yeniden türetme/tekrar tekrar aynı işlemi farklı şekilde ifade etme, ara adımları gereksiz yere tekrarlama. Bir rakamı bir kez doğru ver, aynı hesabı ikinci kez farklı bir sırayla tekrarlama.

YAPABİLECEKLERİN (yalnızca sisteme girilmiş veriler için):
- Tüm dönem gelir/gider ve net kâr yorumu
- SGK fatura ödeme takibi ve tahmin
- Senet vade planı yorumu
- Platform geliri karşılaştırması
- Aylık karşılaştırmalar ve trendler
- Satış Raporu ürün/kategori bazlı gelir analizi
- Envanter/stok değeri özeti (son yüklenen rapora göre)`;

const SYSTEM_PROMPT_EN = `ABSOLUTE RULE — VERY IMPORTANT: 100% of every response MUST be in ENGLISH ONLY. Arabic, Turkish, French, German, Chinese, Japanese, Korean, Russian, or ANY OTHER LANGUAGE is STRICTLY FORBIDDEN — even a single word or character. Do NOT use any Arabic script, Arabic letters, or Arabic words under any circumstances. ENGLISH ONLY.

You are the English AI assistant of the NetaSoft Pharmacy Management System.

YOUR IDENTITY:
You only speak based on real data entered into the NetaSoft system. You do not comment on data not entered into the system, do not generate example figures, do not invent scenarios, and do not give general advice.

STRICT RULES:
1. Every response must be 100% English. Arabic, Turkish, or any other language is FORBIDDEN.
2. If there is no data: say "No records found in the system for this topic."
3. Do not give general financial, accounting, medical or legal advice.
4. Do not respond to topics outside of NetaSoft.
5. SGK income arrives on the 15th of the month, exactly 3 months after the invoice date.
6. For FORWARD-LOOKING questions about an ongoing (not-yet-finished) month — e.g. "will we be profitable this month?" — always use the "MONTH-END FORECAST" block, never the "NET PROFIT/LOSS SO FAR" line, since that only covers elapsed days and presenting it as "this month's profit" while the month is still ongoing is MISLEADING. Only use the "SO FAR" figure if the user explicitly asks about the elapsed period so far. When using the forecast, always state clearly that it is an ESTIMATE, not a guarantee, and briefly mention its basis (days worked so far / remaining working days).
7. If the PROJECTED NET PROFIT/LOSS is positive (profit) and the user asks "what will our loss be", do NOT say "no data found" — instead clearly say there is no projected loss, and state the projected profit amount instead. Symmetrically, if it's negative (loss) and the user asks about profit, say there is no projected profit and state the projected loss amount.
8. Keep numeric explanations SHORT and DIRECT — use the given figures as-is, do not re-derive or restate the same calculation multiple times in different orders, do not repeat intermediate steps unnecessarily. State each number correctly once.

WHAT YOU CAN DO (only for data entered into the system):
- All-period income/expense and net profit commentary
- SGK invoice payment tracking and forecasting
- Promissory note maturity plan commentary
- Platform income comparison
- Monthly comparisons and trends
- Sales Report product/category revenue analysis
- Inventory/stock value summary (based on the last uploaded report)`;

async function getFinancialContext(userId: string, lang: string): Promise<string> {
  const isEn = lang === "en";
  try {
    const activePharmacyId = await getActivePharmacyId(userId);
    if (!activePharmacyId) return isEn ? "No pharmacy found for this user." : "Kullanıcıya ait eczane bulunamadı.";

    const pharmacyId = activePharmacyId;
    const now = new Date();
    const y = now.getUTCFullYear();
    const mo = now.getUTCMonth() + 1;
    const mm = String(mo).padStart(2, "0");
    const lastDayNum = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const startOfMonth = new Date(`${y}-${mm}-01T00:00:00.000Z`);
    const endOfMonth = new Date(`${y}-${mm}-${String(lastDayNum).padStart(2, "0")}T23:59:59.999Z`);

    // Last 12 months for historical context
    const twelveMonthsAgo = new Date(Date.UTC(y, mo - 13, 1));

    const [
      dailyRegs,
      dailyRegs12mo,
      sgkAll,
      platformIncomes,
      fixedExpenses,
      empExpenses,
      allNotes,
      supplierTransfers,
      pharmacy,
      currentMonthSales,
      anySaleExists,
      latestInventoryReport,
    ] = await Promise.all([
      // Current month kasa
      prisma.dailyRegister.findMany({
        where: { pharmacyId, deletedAt: null, registerDate: { gte: startOfMonth, lte: endOfMonth } },
        select: { posAmount: true, cashAmount: true, wireAmount: true, registerDate: true },
      }),
      // Last 12 months kasa (geçmiş aylar hakkında soru sorulabilmesi için)
      prisma.dailyRegister.findMany({
        where: { pharmacyId, deletedAt: null, registerDate: { gte: twelveMonthsAgo } },
        select: { posAmount: true, cashAmount: true, wireAmount: true, registerDate: true },
        orderBy: { registerDate: "desc" },
      }),
      // ALL SGK invoices - show full picture (most recent 40)
      prisma.sgkInvoice.findMany({
        where: { pharmacyId, deletedAt: null },
        select: { amount: true, invoiceType: true, invoiceDate: true, expectedPaymentDate: true },
        orderBy: { expectedPaymentDate: "desc" },
        take: 40,
      }),
      // Platform incomes last 12 months
      prisma.platformIncome.findMany({
        where: { pharmacyId, deletedAt: null, incomeDate: { gte: twelveMonthsAgo } },
        select: { amount: true, platformName: true, status: true, incomeDate: true },
        orderBy: { incomeDate: "desc" },
        take: 30,
      }),
      // Fixed expenses last 12 months
      prisma.fixedExpense.findMany({
        where: { pharmacyId, deletedAt: null, expenseDate: { gte: twelveMonthsAgo } },
        select: { amount: true, type: true, customType: true, expenseDate: true },
        orderBy: { expenseDate: "desc" },
      }),
      // Employee expenses last 12 months
      prisma.employeeExpense.findMany({
        where: { pharmacyId, deletedAt: null, expenseDate: { gte: twelveMonthsAgo } },
        select: { totalAmount: true, expenseDate: true },
      }),
      // All promissory notes
      prisma.promissoryNote.findMany({
        where: { pharmacyId, deletedAt: null },
        select: { amount: true, noteNumber: true, isPaid: true, dueDate: true },
        orderBy: { dueDate: "asc" },
        take: 50,
      }),
      // Supplier transfers last 12 months
      prisma.supplierTransfer.findMany({
        where: { pharmacyId, deletedAt: null, transferDate: { gte: twelveMonthsAgo } },
        select: { amount: true, supplierName: true, transferDate: true },
        orderBy: { transferDate: "desc" },
        take: 20,
      }),
      prisma.pharmacy.findUnique({ where: { id: pharmacyId }, select: { name: true } }),
      // Current month sale records - bounded for LLM context, ordered by revenue
      prisma.saleRecord.findMany({
        where: { pharmacyId, deletedAt: null, saleDate: { gte: startOfMonth, lte: endOfMonth } },
        select: { productGroup: true, productName: true, netRevenue: true, saleType: true, quantity: true },
        orderBy: { netRevenue: "desc" },
        take: 500,
      }),
      // Signal whether the pharmacy has ever uploaded sales data at all
      prisma.saleRecord.findFirst({
        where: { pharmacyId, deletedAt: null },
        select: { id: true },
      }),
      // Most recent inventory analysis snapshot (if any)
      prisma.inventoryReport.findFirst({
        where: { pharmacyId, deletedAt: null },
        select: {
          fileName: true,
          totalProducts: true,
          soldProducts: true,
          totalRevenue: true,
          totalCost: true,
          totalProfit: true,
          profitMargin: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const cashIncome = dailyRegs.reduce((s, r) => s + Number(r.posAmount) + Number(r.cashAmount) + Number(r.wireAmount), 0);

    // SGK grouped: this month received vs pending vs upcoming
    const thisMonthSgk = sgkAll.filter(s => {
      const pd = new Date(s.expectedPaymentDate);
      return pd >= startOfMonth && pd <= endOfMonth;
    });
    const upcomingSgk = sgkAll.filter(s => new Date(s.expectedPaymentDate) > endOfMonth);
    const pastSgk = sgkAll.filter(s => new Date(s.expectedPaymentDate) < startOfMonth);

    const thisMonthSgkTotal = thisMonthSgk.reduce((s, r) => s + Number(r.amount), 0);
    const platformTotal = platformIncomes.filter(p => {
      const d = new Date(p.incomeDate);
      return d >= startOfMonth && d <= endOfMonth;
    }).reduce((s, r) => s + Number(r.amount), 0);

    const fixedExp12 = fixedExpenses.reduce((s, r) => s + Number(r.amount), 0);
    const empExp12 = empExpenses.reduce((s, r) => s + Number(r.totalAmount), 0);
    const supplierTotal12 = supplierTransfers.reduce((s, r) => s + Number(r.amount), 0);

    // Aylık kırılım (son 12 ay) — geçmiş aylar hakkında sorulan sorulara cevap verebilmek için
    const monthKey = (d: Date | string) => {
      const dt = new Date(d);
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
    };
    const monthlyMap = new Map<string, { cash: number; sgk: number; platform: number; fixed: number; emp: number }>();
    const ensureMonth = (key: string) => {
      if (!monthlyMap.has(key)) monthlyMap.set(key, { cash: 0, sgk: 0, platform: 0, fixed: 0, emp: 0 });
      return monthlyMap.get(key)!;
    };
    dailyRegs12mo.forEach(r => {
      const bucket = ensureMonth(monthKey(r.registerDate));
      bucket.cash += Number(r.posAmount) + Number(r.cashAmount) + Number(r.wireAmount);
    });
    sgkAll.forEach(s => {
      const bucket = ensureMonth(monthKey(s.expectedPaymentDate));
      bucket.sgk += Number(s.amount);
    });
    platformIncomes.forEach(p => {
      const bucket = ensureMonth(monthKey(p.incomeDate));
      bucket.platform += Number(p.amount);
    });
    fixedExpenses.forEach(e => {
      const bucket = ensureMonth(monthKey(e.expenseDate));
      bucket.fixed += Number(e.amount);
    });
    empExpenses.forEach(e => {
      const bucket = ensureMonth(monthKey(e.expenseDate));
      bucket.emp += Number(e.totalAmount);
    });
    const monthlyKeysSorted = Array.from(monthlyMap.keys()).sort();

    const unpaidNotes = allNotes.filter(n => !n.isPaid);
    const paidNotes = allNotes.filter(n => n.isPaid);
    const upcomingNotes = unpaidNotes.filter(n => new Date(n.dueDate) > now);
    const overdueNotes = unpaidNotes.filter(n => new Date(n.dueDate) <= now);

    const totalIncome = cashIncome + thisMonthSgkTotal + platformTotal;
    const thisMonthFixed = fixedExpenses.filter(e => {
      const d = new Date(e.expenseDate);
      return d >= startOfMonth && d <= endOfMonth;
    }).reduce((s, r) => s + Number(r.amount), 0);
    const thisMonthEmp = empExpenses.filter(e => {
      const d = new Date(e.expenseDate);
      return d >= startOfMonth && d <= endOfMonth;
    }).reduce((s, r) => s + Number(r.totalAmount), 0);

    // ── AY SONU CİRO TAHMİNİ ─────────────────────────────────────────────────
    // Kullanıcı "bu ay kâr eder miyiz" gibi GELECEĞE dönük bir soru sorduğunda,
    // sadece bugüne kadar gerçekleşen kısmi ay verisini net kâr/zarar diye
    // sunmak yanıltıcıydı (ay henüz bitmedi). Bunun yerine: fiilen kasa girişi
    // yapılan (çalışılan) günlere göre günlük ortalama ciro hesaplanır, ayın
    // kalan günlerinden resmi tatiller düşülerek tahmini kalan çalışma günü
    // bulunur ve bu ortalamayla ay sonuna kadar projekte edilir. Sabit/personel
    // giderleri günlük bir kalem olmadığı için (runway30 ile aynı gerekçe)
    // ekstrapole edilmez, bu ana kadarki gerçek tutarları kullanılır.
    const workedDayKeys = new Set(
      dailyRegs.map(r => {
        const d = new Date(r.registerDate);
        return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
      })
    );
    const workedDaysCount = workedDayKeys.size;
    const avgCiroPerWorkedDay = workedDaysCount > 0 ? cashIncome / workedDaysCount : 0;

    const todayDateNum = now.getUTCDate();
    const remainingCalendarDays = Math.max(0, lastDayNum - todayDateNum);
    const tomorrow = new Date(Date.UTC(y, mo - 1, todayDateNum + 1));
    const remainingHolidays = remainingCalendarDays > 0 ? countHolidaysInRange(tomorrow, endOfMonth) : 0;
    const projectedRemainingWorkingDays = Math.max(0, remainingCalendarDays - remainingHolidays);
    const projectedRemainingCash = avgCiroPerWorkedDay * projectedRemainingWorkingDays;
    const projectedMonthCash = cashIncome + projectedRemainingCash;
    const projectedTotalIncome = projectedMonthCash + thisMonthSgkTotal + platformTotal;
    const projectedExpense = thisMonthFixed + thisMonthEmp;
    const projectedNet = projectedTotalIncome - projectedExpense;
    const isMonthOver = remainingCalendarDays === 0;

    // ── SATIŞ RAPORU (BU AY) ─────────────────────────────────────────────────
    const salesTxCount = currentMonthSales.length;
    const prescriptionSales = currentMonthSales.filter(s => s.saleType === "PRESCRIPTION");
    const retailSales = currentMonthSales.filter(s => s.saleType === "RETAIL");
    const prescriptionRevenue = prescriptionSales.reduce((s, r) => s + Number(r.netRevenue), 0);
    const retailRevenue = retailSales.reduce((s, r) => s + Number(r.netRevenue), 0);
    const totalSalesRevenue = prescriptionRevenue + retailRevenue;

    const topProducts = [...currentMonthSales]
      .sort((a, b) => Number(b.netRevenue) - Number(a.netRevenue))
      .slice(0, 10);

    const groupRevenueMap = new Map<string, number>();
    currentMonthSales.forEach(s => {
      const key = s.productGroup ?? (isEn ? "Uncategorized" : "Kategorisiz");
      groupRevenueMap.set(key, (groupRevenueMap.get(key) ?? 0) + Number(s.netRevenue));
    });
    const topGroups = Array.from(groupRevenueMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // ÖNEMLİ: `maximumFractionDigits` verilmezse tr-TR yerel ayarı bazı ondalıklı
    // sayıları (ör. bölme sonucu oluşan 47641.363636... gibi kesirli tahmin
    // rakamları) 3 basamağa kadar gösterebiliyordu (ör. "1.846.382,723 TL").
    // Bu bozuk görünümlü sayı, modelin kendi metin çıktısında saçma/çok dilli
    // bir tekrar döngüsüne girmesine yol açan gerçek bir üretim hatasıydı —
    // para birimi HER ZAMAN tam olarak 2 ondalık basamakla gösterilmeli.
    const fmt = (v: number) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";
    const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString(isEn ? "en-GB" : "tr-TR");

    const monthLabel = now.toLocaleDateString(isEn ? "en-GB" : "tr-TR", { month: "long", year: "numeric" });

    const L = {
      pharmacy: isEn ? "Pharmacy" : "Eczane",
      period: isEn ? "Period" : "Dönem",
      income: isEn ? "INCOME (CURRENT MONTH)" : "GELİRLER (BU AY)",
      cash: isEn ? "Cash Register (POS+Cash+Wire)" : "Kasa (Nakit+POS+Havale)",
      days: isEn ? "days" : "gün",
      sgkThisMonth: isEn ? "SGK Income (payments due this month)" : "SGK Geliri (bu ay ödenecek faturalar)",
      invoices: isEn ? "invoices" : "fatura",
      platform: isEn ? "Platform Income" : "Platform Gelirleri",
      records: isEn ? "records" : "kayıt",
      totalIncome: isEn ? "TOTAL INCOME" : "TOPLAM GELİR",
      expenses: isEn ? "EXPENSES (CURRENT MONTH)" : "GİDERLER (BU AY)",
      fixed: isEn ? "Fixed Expenses" : "Sabit Giderler",
      staff: isEn ? "Staff Expenses" : "Personel Giderleri",
      supplier: isEn ? "Warehouse Transfers" : "Depo Havaleleri",
      net: isEn ? "NET PROFIT/LOSS SO FAR (only elapsed days this month, NOT a full-month figure)" : "BUGÜNE KADAR GERÇEKLEŞEN NET KAR/ZARAR (sadece ayın şu ana kadar geçen günleri, TAM AY rakamı DEĞİLDİR)",
      forecast: isEn ? "MONTH-END FORECAST (ESTIMATE — use this for questions like \"will we be profitable this month\")" : "AY SONU TAHMİNİ (TAHMİNİDİR — \"bu ay kâr eder miyiz/edecek miyiz\" gibi sorular için BUNU kullan)",
      forecastWorkedDays: isEn ? "Days worked so far (days with a register entry)" : "Bugüne kadar çalışılan gün sayısı (kasa girişi yapılan günler)",
      forecastAvgPerDay: isEn ? "Average register revenue per worked day" : "Çalışılan gün başına ortalama kasa cirosu",
      forecastRemainingDays: isEn ? "Remaining calendar days this month" : "Ayın kalan takvim günü",
      forecastRemainingHolidays: isEn ? "Official holidays among remaining days" : "Kalan günler içindeki resmi tatil sayısı",
      forecastRemainingWorkingDays: isEn ? "Estimated remaining working days" : "Tahmini kalan çalışma günü",
      forecastProjectedIncome: isEn ? "Projected total income (month-end)" : "Tahmini ay sonu toplam gelir",
      forecastProjectedExpense: isEn ? "Expenses used in forecast (fixed+staff, not extrapolated — see note)" : "Tahminde kullanılan gider (sabit+personel, ekstrapole edilmez — açıklamaya bakın)",
      forecastNet: isEn ? "PROJECTED NET PROFIT/LOSS (month-end estimate)" : "TAHMİNİ NET KAR/ZARAR (ay sonu tahmini)",
      forecastNote: isEn
        ? "This is an ESTIMATE based on the average revenue of days actually worked so far, projected across the remaining working days (calendar days minus official Turkish holidays) until month-end. Fixed/staff expenses are usually one-time monthly entries, so they are NOT extrapolated — this month's actual amounts are used as-is. Always tell the user this is an estimate, not a guarantee."
        : "Bu bir TAHMİNDİR: bugüne kadar fiilen çalışılan günlerin ortalama cirosu, ay sonuna kadar kalan çalışma günlerine (takvim günü eksi resmi tatiller) yansıtılarak hesaplanmıştır. Sabit/personel giderleri genelde ay içinde tek seferlik girildiği için ekstrapole EDİLMEZ, bu ayki gerçek tutarları kullanılır. Kullanıcıya bunun bir tahmin olduğunu, kesin bir garanti olmadığını her zaman belirt.",
      monthOver: isEn ? "This month has already ended — the figures above ARE the final month total, not an estimate." : "Bu ay zaten sona erdi — yukarıdaki rakamlar tahmin değil, ayın kesin toplam sonucudur.",
      sgkAll: isEn ? "ALL SGK INVOICES (full history)" : "TÜM SGK FATURALARI (tüm geçmiş)",
      sgkNote: isEn ? "SGK payments arrive on the 15th of the month, 3 months after invoice date." : "SGK ödemeleri fatura ayından 3 ay sonra, her ayın 15'inde gelir.",
      invoiceDate: isEn ? "Invoice Date" : "Fatura Tarihi",
      payDate: isEn ? "Payment Date" : "Ödeme Tarihi",
      pastPaid: isEn ? "Past (already paid to pharmacy)" : "Geçmiş (eczaneye ödenmiş)",
      upcoming: isEn ? "Upcoming" : "Yaklaşan",
      notes: isEn ? "PROMISSORY NOTES" : "SENETLER",
      paid: isEn ? "Paid" : "Ödendi",
      pending: isEn ? "Pending" : "Bekliyor",
      overdue: isEn ? "OVERDUE NOTES" : "VADESİ GEÇMİŞ SENETLER",
      future: isEn ? "UPCOMING NOTES" : "GELECEK VADELİ SENETLER",
      due: isEn ? "Due" : "Vade",
      history12: isEn ? "12-MONTH TOTALS (last 12 months)" : "12 AYLIK TOPLAMLAR (son 12 ay)",
      monthlyBreakdown: isEn ? "MONTH-BY-MONTH BREAKDOWN (use this for questions about a specific past month)" : "AYLIK KIRILIM (belirli bir geçmiş ay sorulduğunda bunu kullan)",
      salesReport: isEn ? "SALES REPORT (CURRENT MONTH)" : "SATIŞ RAPORU (BU AY)",
      salesNoDataEver: isEn ? "Sales Report: No sales data has ever been uploaded for this pharmacy." : "Satış Raporu: Bu eczane için henüz satış verisi yüklenmemiş.",
      salesNoDataThisMonth: isEn ? "No sale records found for the current month (sales data exists for other months)." : "Bu ay için satış kaydı bulunamadı (başka aylara ait satış verisi mevcut).",
      salesTxCount: isEn ? "Transaction Count" : "İşlem Sayısı",
      salesPrescription: isEn ? "Prescription Sales Revenue" : "Reçeteli Satış Geliri",
      salesRetail: isEn ? "Retail Sales Revenue" : "Perakende Satış Geliri",
      salesTotal: isEn ? "Total Sales Revenue" : "Toplam Satış Geliri",
      topProducts: isEn ? "Top Products by Revenue" : "Gelire Göre En Çok Satan Ürünler",
      topGroups: isEn ? "Top Product Groups by Revenue" : "Gelire Göre En Çok Satan Ürün Grupları",
      inventoryReport: isEn ? "INVENTORY ANALYSIS (SNAPSHOT — NOT LIVE STOCK)" : "ENVANTER ANALİZİ (ANLIK DEĞİL, KAYDEDİLMİŞ RAPOR)",
      inventoryNoData: isEn ? "Inventory Report: No inventory analysis has ever been uploaded for this pharmacy." : "Envanter Analizi: Bu eczane için henüz envanter raporu yüklenmemiş.",
      inventoryAsOf: isEn ? "As of the last uploaded inventory report (snapshot date)" : "Son yüklenen envanter raporuna göre (rapor tarihi)",
      inventoryFileName: isEn ? "Source File" : "Kaynak Dosya",
      inventoryTotalProducts: isEn ? "Total Products" : "Toplam Ürün",
      inventorySoldProducts: isEn ? "Sold Products" : "Satılan Ürün",
      inventoryTotalRevenue: isEn ? "Total Revenue" : "Toplam Gelir",
      inventoryTotalCost: isEn ? "Total Cost" : "Toplam Maliyet",
      inventoryTotalProfit: isEn ? "Total Profit" : "Toplam Kâr",
      inventoryProfitMargin: isEn ? "Profit Margin" : "Kâr Marjı",
    };

    const lines: string[] = [
      `${L.pharmacy}: ${pharmacy?.name ?? (isEn ? "Unknown" : "Bilinmiyor")}`,
      `${L.period}: ${monthLabel}`,
      ``,
      `${L.income}`,
      `- ${L.cash}: ${fmt(cashIncome)} (${dailyRegs.length} ${L.days})`,
      `- ${L.sgkThisMonth}: ${fmt(thisMonthSgkTotal)} (${thisMonthSgk.length} ${L.invoices})`,
      `- ${L.platform}: ${fmt(platformTotal)}`,
      `- ${L.totalIncome}: ${fmt(totalIncome)}`,
      ``,
      `${L.expenses}`,
      `- ${L.fixed}: ${fmt(thisMonthFixed)}`,
      `- ${L.staff}: ${fmt(thisMonthEmp)}`,
      `- ${L.supplier}: ${fmt(supplierTransfers.filter(t => { const d = new Date(t.transferDate); return d >= startOfMonth && d <= endOfMonth; }).reduce((s, r) => s + Number(r.amount), 0))}`,
      `- ${L.net}: ${fmt(totalIncome - thisMonthFixed - thisMonthEmp)}`,
      ``,
      `${L.forecast}`,
      ...(isMonthOver
        ? [`(${L.monthOver})`]
        : [
            `- ${L.forecastWorkedDays}: ${workedDaysCount} ${L.days}`,
            `- ${L.forecastAvgPerDay}: ${fmt(avgCiroPerWorkedDay)}`,
            `- ${L.forecastRemainingDays}: ${remainingCalendarDays} ${L.days}`,
            `- ${L.forecastRemainingHolidays}: ${remainingHolidays} ${L.days}`,
            `- ${L.forecastRemainingWorkingDays}: ${projectedRemainingWorkingDays} ${L.days}`,
            `- ${L.forecastProjectedIncome}: ${fmt(projectedTotalIncome)}`,
            `- ${L.forecastProjectedExpense}: ${fmt(projectedExpense)}`,
            `- ${L.forecastNet}: ${fmt(projectedNet)}`,
          ]),
      `(${L.forecastNote})`,
      ``,
      `${L.sgkAll}`,
      `${L.sgkNote}`,
    ];

    if (pastSgk.length > 0) {
      lines.push(`  ${L.pastPaid} (${pastSgk.length}):`);
      pastSgk.slice(0, 10).forEach(s => {
        lines.push(`    * ${s.invoiceType} | ${L.invoiceDate}: ${fmtDate(s.invoiceDate)} | ${L.payDate}: ${fmtDate(s.expectedPaymentDate)} | ${fmt(Number(s.amount))}`);
      });
    }
    if (thisMonthSgk.length > 0) {
      lines.push(`  ${isEn ? "This month" : "Bu ay"} (${thisMonthSgk.length}):`);
      thisMonthSgk.forEach(s => {
        lines.push(`    * ${s.invoiceType} | ${L.payDate}: ${fmtDate(s.expectedPaymentDate)} | ${fmt(Number(s.amount))}`);
      });
    }
    if (upcomingSgk.length > 0) {
      lines.push(`  ${L.upcoming} (${upcomingSgk.length}):`);
      upcomingSgk.forEach(s => {
        lines.push(`    * ${s.invoiceType} | ${L.invoiceDate}: ${fmtDate(s.invoiceDate)} | ${L.payDate}: ${fmtDate(s.expectedPaymentDate)} | ${fmt(Number(s.amount))}`);
      });
    }

    lines.push(``, `${L.notes}`);
    lines.push(`  ${L.paid}: ${paidNotes.length} | ${L.pending}: ${unpaidNotes.length}`);

    if (overdueNotes.length > 0) {
      lines.push(`  ${L.overdue}:`);
      overdueNotes.forEach(n => lines.push(`    * ${isEn ? "Note" : "Senet"} #${n.noteNumber}: ${fmt(Number(n.amount))} — ${L.due}: ${fmtDate(n.dueDate)}`));
    }
    if (upcomingNotes.length > 0) {
      lines.push(`  ${L.future}:`);
      upcomingNotes.slice(0, 10).forEach(n => lines.push(`    * ${isEn ? "Note" : "Senet"} #${n.noteNumber}: ${fmt(Number(n.amount))} — ${L.due}: ${fmtDate(n.dueDate)}`));
    }

    lines.push(
      ``,
      `${L.history12}`,
      `- ${isEn ? "Fixed Expenses" : "Sabit Giderler"} (12 mo): ${fmt(fixedExp12)}`,
      `- ${isEn ? "Staff Expenses" : "Personel Giderleri"} (12 mo): ${fmt(empExp12)}`,
      `- ${isEn ? "Warehouse Transfers" : "Depo Havaleleri"} (12 mo): ${fmt(supplierTotal12)}`,
    );

    lines.push(``, `${L.monthlyBreakdown}`);
    monthlyKeysSorted.forEach(key => {
      const b = monthlyMap.get(key)!;
      const [yy, mmk] = key.split("-");
      const label = new Date(Number(yy), Number(mmk) - 1, 1).toLocaleDateString(isEn ? "en-GB" : "tr-TR", { month: "long", year: "numeric" });
      const income = b.cash + b.sgk + b.platform;
      const expense = b.fixed + b.emp;
      lines.push(`  * ${label}: ${isEn ? "Cash" : "Kasa"} ${fmt(b.cash)}, SGK ${fmt(b.sgk)}, ${isEn ? "Platform" : "Platform"} ${fmt(b.platform)}, ${isEn ? "Total Income" : "Toplam Gelir"} ${fmt(income)}, ${isEn ? "Fixed Exp" : "Sabit Gider"} ${fmt(b.fixed)}, ${isEn ? "Staff Exp" : "Personel Gideri"} ${fmt(b.emp)}, ${isEn ? "Total Expense" : "Toplam Gider"} ${fmt(expense)}, ${isEn ? "Net" : "Net"} ${fmt(income - expense)}`);
    });

    if (platformIncomes.length > 0) {
      lines.push(``, `${isEn ? "PLATFORM INCOME HISTORY" : "PLATFORM GELİRLERİ GEÇMİŞİ"}`);
      const byPlatform: Record<string, number> = {};
      platformIncomes.forEach(p => { byPlatform[p.platformName] = (byPlatform[p.platformName] ?? 0) + Number(p.amount); });
      Object.entries(byPlatform).forEach(([name, total]) => lines.push(`  * ${name}: ${fmt(total)}`));
    }

    lines.push(``, `${L.salesReport}`);
    if (!anySaleExists) {
      lines.push(`  (${L.salesNoDataEver})`);
    } else if (salesTxCount === 0) {
      lines.push(`  (${L.salesNoDataThisMonth})`);
    } else {
      lines.push(`- ${L.salesTxCount}: ${salesTxCount}`);
      lines.push(`- ${L.salesPrescription}: ${fmt(prescriptionRevenue)} (${prescriptionSales.length} ${L.records})`);
      lines.push(`- ${L.salesRetail}: ${fmt(retailRevenue)} (${retailSales.length} ${L.records})`);
      lines.push(`- ${L.salesTotal}: ${fmt(totalSalesRevenue)}`);
      lines.push(`  ${L.topProducts}:`);
      topProducts.forEach(p => lines.push(`    * ${p.productName}${p.productGroup ? ` (${p.productGroup})` : ""}: ${fmt(Number(p.netRevenue))} — ${isEn ? "Qty" : "Adet"}: ${p.quantity}`));
      lines.push(`  ${L.topGroups}:`);
      topGroups.forEach(([name, total]) => lines.push(`    * ${name}: ${fmt(total)}`));
    }

    lines.push(``, `${L.inventoryReport}`);
    if (!latestInventoryReport) {
      lines.push(`  (${L.inventoryNoData})`);
    } else {
      lines.push(`- ${L.inventoryAsOf}: ${fmtDate(latestInventoryReport.createdAt)}`);
      lines.push(`- ${L.inventoryFileName}: ${latestInventoryReport.fileName}`);
      lines.push(`- ${L.inventoryTotalProducts}: ${latestInventoryReport.totalProducts}`);
      lines.push(`- ${L.inventorySoldProducts}: ${latestInventoryReport.soldProducts}`);
      lines.push(`- ${L.inventoryTotalRevenue}: ${fmt(Number(latestInventoryReport.totalRevenue))}`);
      lines.push(`- ${L.inventoryTotalCost}: ${fmt(Number(latestInventoryReport.totalCost))}`);
      lines.push(`- ${L.inventoryTotalProfit}: ${fmt(Number(latestInventoryReport.totalProfit))}`);
      lines.push(`- ${L.inventoryProfitMargin}: %${Number(latestInventoryReport.profitMargin).toLocaleString(isEn ? "en-GB" : "tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }

    return lines.join("\n");
  } catch {
    return isEn ? "Error retrieving financial data." : "Finansal veriler alınırken hata oluştu.";
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const reqLang = getLang(req);
  const session = await auth();
  if (!session?.user?.id) return apiError(m("unauthorized", reqLang), "UNAUTHORIZED", 401);

  const rl = rateLimit(`ai-chat:${session.user.id}`, AI_CHAT_RATE_LIMIT, AI_CHAT_RATE_WINDOW_MS);
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return apiError(
      reqLang === "en"
        ? `Too many requests. Please try again in ${retryAfterSec} seconds.`
        : `Çok fazla istek gönderildi. Lütfen ${retryAfterSec} saniye sonra tekrar deneyin.`,
      "RATE_LIMITED",
      429,
    );
  }

  const body = await req.json() as { messages: Array<{ role: "user" | "assistant"; content: string }>; lang?: string };
  const { messages, lang } = body;
  const systemPrompt = lang === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_TR;

  if (!messages?.length) return apiError("Mesaj bulunamadı", "NO_MESSAGES", 400);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return apiError("AI servisi yapılandırılmamış. Lütfen GROQ_API_KEY ayarlayın.", "NO_API_KEY", 503);
  }

  const financialContext = await getFinancialContext(session.user.id, lang ?? "tr");
  const client = new Groq({ apiKey });

  // Simulate thinking delay so the assistant appears to reflect before answering
  await new Promise<void>(r => setTimeout(r, 1200));

  try {
    const stream = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1200,
      temperature: 0.3,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `[SYSTEM FINANCIAL DATA — DO NOT SHOW TO USER — READ AND ANALYZE ONLY]\n\n${financialContext}\n\n[END OF SYSTEM DATA]`,
        },
        {
          role: "assistant",
          content: lang === "en"
            ? "I have reviewed your pharmacy financial data. How can I help you today?"
            : "Eczane finansal verilerinizi inceledim. Size nasıl yardımcı olabilirim?",
        },
        ...messages,
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI servisi hatası";
    return apiError(message, "AI_ERROR", 500);
  }
}
