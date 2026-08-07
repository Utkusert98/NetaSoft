import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/utils";
import { getLang, m } from "@/lib/i18n/api-messages";

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

YAPABİLECEKLERİN (yalnızca sisteme girilmiş veriler için):
- Tüm dönem gelir/gider ve net kâr yorumu
- SGK fatura ödeme takibi ve tahmin
- Senet vade planı yorumu
- Platform geliri karşılaştırması
- Aylık karşılaştırmalar ve trendler`;

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

WHAT YOU CAN DO (only for data entered into the system):
- All-period income/expense and net profit commentary
- SGK invoice payment tracking and forecasting
- Promissory note maturity plan commentary
- Platform income comparison
- Monthly comparisons and trends`;

async function getFinancialContext(userId: string, lang: string): Promise<string> {
  const isEn = lang === "en";
  try {
    const userRole = await prisma.userPharmacyRole.findFirst({
      where: { userId },
      select: { pharmacyId: true },
    });
    if (!userRole) return isEn ? "No pharmacy found for this user." : "Kullanıcıya ait eczane bulunamadı.";

    const pharmacyId = userRole.pharmacyId;
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
      sgkAll,
      platformIncomes,
      fixedExpenses,
      empExpenses,
      allNotes,
      supplierTransfers,
      pharmacy,
    ] = await Promise.all([
      // Current month kasa
      prisma.dailyRegister.findMany({
        where: { pharmacyId, deletedAt: null, registerDate: { gte: startOfMonth, lte: endOfMonth } },
        select: { posAmount: true, cashAmount: true, wireAmount: true },
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

    const fmt = (v: number) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " TL";
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
      net: isEn ? "NET PROFIT/LOSS" : "NET KAR/ZARAR",
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

    if (platformIncomes.length > 0) {
      lines.push(``, `${isEn ? "PLATFORM INCOME HISTORY" : "PLATFORM GELİRLERİ GEÇMİŞİ"}`);
      const byPlatform: Record<string, number> = {};
      platformIncomes.forEach(p => { byPlatform[p.platformName] = (byPlatform[p.platformName] ?? 0) + Number(p.amount); });
      Object.entries(byPlatform).forEach(([name, total]) => lines.push(`  * ${name}: ${fmt(total)}`));
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
