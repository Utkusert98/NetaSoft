import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/utils";

const SYSTEM_PROMPT = `KRITIK KURAL: Yanıtlarının HER KELİMESİ Türkçe olmalıdır. İngilizce, Fransızca, Almanca veya başka herhangi bir dilden tek bir kelime bile kullanma. "only", "the", "and", "but", "also", "however", "therefore" gibi İngilizce kelimeler KESİNLİKLE YASAKTIR. Türkçe karşılıklarını kullan: "sadece", "bu", "ve", "ama", "ayrıca", "ancak", "bu nedenle".

Sen NetaSoft Eczane Yönetim Sistemi'nin Türkçe yapay zeka asistanısın.

KIMLIĞIN:
Yalnızca NetaSoft sistemine girilmiş gerçek verilere dayanarak konuşursun. Sisteme girilmemiş hiçbir veri hakkında yorum yapmazsın, örnek rakam üretmezsin, senaryo uydurmaz veya genel tavsiye vermezsin.

KESIN KURALLAR:
1. Her yanıt yüzde yüz Türkçe olacak. Yabancı dil kelimesi kullanmak yasaktır.
2. Veri yoksa: "Sistemde bu konuya ait kayıt bulunamadı." dersin. Başka bir şey söylemezsin.
3. Genel finansal, muhasebe, tıbbi veya hukuki tavsiye vermezsin.
4. NetaSoft dışı konulara yanıt vermezsin.

YAPABİLECEKLERİN (yalnızca sisteme girilmiş veriler için):
- Aylık gelir/gider ve net kâr yorumu
- SGK fatura ödeme takibi
- Senet vade planı yorumu
- Platform geliri karşılaştırması

YASAK:
- Yabancı kelime kullanmak (only, the, also, however, therefore, systémde vb.)
- Sisteme girilmemiş veriyi varmış gibi göstermek
- Genel tavsiye vermek`;



async function getFinancialContext(userId: string): Promise<string> {
  try {
    const userRole = await prisma.userPharmacyRole.findFirst({
      where: { userId },
      select: { pharmacyId: true },
      });
    if (!userRole) return "Kullanıcıya ait eczane bulunamadı.";

    const pharmacyId = userRole.pharmacyId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [dailyRegs, sgkInvoices, platformIncomes, fixedExpenses, empExpenses, monthNotes, upcomingNotes, supplierTransfers, pharmacy] = await Promise.all([
      prisma.dailyRegister.findMany({ where: { pharmacyId, deletedAt: null, registerDate: { gte: startOfMonth, lte: endOfMonth } }, select: { posAmount: true, cashAmount: true, wireAmount: true } }),
      prisma.sgkInvoice.findMany({ where: { pharmacyId, deletedAt: null, invoiceDate: { gte: startOfMonth, lte: endOfMonth } }, select: { amount: true, invoiceType: true } }),
      prisma.platformIncome.findMany({ where: { pharmacyId, deletedAt: null, incomeDate: { gte: startOfMonth, lte: endOfMonth } }, select: { amount: true, platformName: true, status: true } }),
      prisma.fixedExpense.findMany({ where: { pharmacyId, deletedAt: null, expenseDate: { gte: startOfMonth, lte: endOfMonth } }, select: { amount: true, type: true, customType: true, notes: true } }),
      prisma.employeeExpense.findMany({ where: { pharmacyId, deletedAt: null, expenseDate: { gte: startOfMonth, lte: endOfMonth } }, select: { totalAmount: true } }),
      // Bu ay vadesi gelen TÜM senetler (ödendi veya ödenmedik — gösterge paneli ile aynı formül)
      prisma.promissoryNote.findMany({ where: { pharmacyId, deletedAt: null, dueDate: { gte: startOfMonth, lte: endOfMonth } }, select: { amount: true, noteNumber: true, isPaid: true }, orderBy: { isPaid: "asc" } }),
      // Gelecek vadeli ödenmemiş senetler (bilgilendirme amaçlı)
      prisma.promissoryNote.findMany({ where: { pharmacyId, deletedAt: null, isPaid: false, dueDate: { gt: endOfMonth } }, select: { amount: true, noteNumber: true, dueDate: true }, orderBy: { dueDate: "asc" }, take: 10 }),
      // Bu ay depo havaleleri
      prisma.supplierTransfer.findMany({ where: { pharmacyId, deletedAt: null, transferDate: { gte: startOfMonth, lte: endOfMonth } }, select: { amount: true, supplierName: true } }),
      prisma.pharmacy.findUnique({ where: { id: pharmacyId }, select: { name: true } }),
    ]);

    const cashIncome = dailyRegs.reduce((s, r) => s + Number(r.posAmount) + Number(r.cashAmount) + Number(r.wireAmount), 0);
    const sgkTotal = sgkInvoices.reduce((s, r) => s + Number(r.amount), 0);
    const platformTotal = platformIncomes.reduce((s, r) => s + Number(r.amount), 0);
    const fixedExp = fixedExpenses.reduce((s, r) => s + Number(r.amount), 0);
    const empExp = empExpenses.reduce((s, r) => s + Number(r.totalAmount), 0);
    // Gösterge paneli ile aynı formül: bu ay vadesi gelen tüm senetler gider
    const notesTotal = monthNotes.reduce((s, r) => s + Number(r.amount), 0);
    const supplierTotal = supplierTransfers.reduce((s, r) => s + Number(r.amount), 0);
    const upcomingTotal = upcomingNotes.reduce((s, r) => s + Number(r.amount), 0);

    const totalIncome = cashIncome + sgkTotal + platformTotal;
    // Gösterge paneli ile birebir aynı: sabit + personel + bu ay vadeli senetler
    const totalExpense = fixedExp + empExp + notesTotal;
    const monthLabel = now.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
    const fmt = (v: number) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2 });

    const paidNotes = monthNotes.filter(n => n.isPaid);
    const unpaidMonthNotes = monthNotes.filter(n => !n.isPaid);

    const lines: string[] = [
      `Eczane: ${pharmacy?.name ?? "Bilinmiyor"}`,
      `Dönem: ${monthLabel}`,
      ``,
      `GELİRLER`,
      `- Kasa (Nakit+POS+Havale): ${fmt(cashIncome)} TL (${dailyRegs.length} gün)`,
      `- SGK Faturaları: ${fmt(sgkTotal)} TL (${sgkInvoices.length} fatura)`,
      `- Platform Gelirleri: ${fmt(platformTotal)} TL (${platformIncomes.length} kayıt)`,
      `- TOPLAM GELİR: ${fmt(totalIncome)} TL`,
      ``,
      `GİDERLER (Gösterge Paneli ile aynı hesaplama)`,
      `- Sabit Giderler: ${fmt(fixedExp)} TL (${fixedExpenses.length} kalem)`,
    ];

    if (fixedExpenses.length > 0) {
      const typeLabel = (type: string, custom?: string | null): string =>
        ({ INVOICE: "Fatura", ACCOUNTING: "Muhasebe", TAX: "Vergi", RENT: "Kira", OTHER: custom ?? "Diğer" }[type] ?? type);
      fixedExpenses.forEach(e => lines.push(`  * ${typeLabel(e.type, e.customType)}${e.notes ? " (" + e.notes + ")" : ""}: ${fmt(Number(e.amount))} TL`));
    }

    lines.push(`- Personel Giderleri: ${fmt(empExp)} TL (${empExpenses.length} kayıt)`);
    lines.push(`- Bu Ay Vadeli Senetler: ${fmt(notesTotal)} TL (${monthNotes.length} senet — ${paidNotes.length} ödendi, ${unpaidMonthNotes.length} bekliyor)`);
    if (monthNotes.length > 0) {
      monthNotes.forEach(n => lines.push(`  * Senet ${n.noteNumber}: ${fmt(Number(n.amount))} TL — ${n.isPaid ? "Ödendi" : "Bekliyor"}`));
    }

    if (supplierTotal > 0) {
      lines.push(`- Depo Havaleleri / EFT: ${fmt(supplierTotal)} TL (${supplierTransfers.length} transfer — bu kalem gösterge paneline dahil değildir)`);
      supplierTransfers.forEach(t => lines.push(`  * ${t.supplierName}: ${fmt(Number(t.amount))} TL`));
    }

    lines.push(
      `- TOPLAM GİDER: ${fmt(totalExpense)} TL`,
      ``,
      `NET KAR/ZARAR: ${fmt(totalIncome - totalExpense)} TL`,
      ``,
    );

    if (upcomingNotes.length > 0) {
      lines.push(`GELECEK VADELI ÖDENMEMIŞ SENETLER (Toplam: ${fmt(upcomingTotal)} TL)`);
      upcomingNotes.forEach(n => {
        const dateStr = new Date(n.dueDate).toLocaleDateString("tr-TR");
        lines.push(`  * Senet ${n.noteNumber}: ${fmt(Number(n.amount))} TL — Vade: ${dateStr}`);
      });
      lines.push(``);
    }

    if (platformIncomes.length > 0) {
      lines.push(`PLATFORM GELİRLERİ DETAYI`);
      platformIncomes.forEach(p => {
        const durum = p.status === "PENDING" ? "Beklemede" : p.status === "RECEIVED" ? "Alındı" : "İptal";
        lines.push(`  * ${p.platformName} (${durum}): ${fmt(Number(p.amount))} TL`);
      });
    }

    return lines.join("\n");
  } catch {
    return "Finansal veriler alınırken hata oluştu.";
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return apiError("Yetkisiz", "UNAUTHORIZED", 401);

  const body = await req.json() as { messages: Array<{ role: "user" | "assistant"; content: string }> };
  const { messages } = body;

  if (!messages?.length) return apiError("Mesaj bulunamadı", "NO_MESSAGES", 400);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return apiError("AI servisi yapılandırılmamış. Lütfen GROQ_API_KEY ayarlayın.", "NO_API_KEY", 503);
  }

  const financialContext = await getFinancialContext(session.user.id);
  const client = new Groq({ apiKey });

  try {
    const stream = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `[SİSTEM VERİSİ — KULLANICIYA GÖSTERME]\n\n${financialContext}` },
        { role: "assistant", content: "Finansal verilerinize eriştim. Size nasıl yardımcı olabilirim?" },
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
