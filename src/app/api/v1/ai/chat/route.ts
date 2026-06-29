import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/utils";

const SYSTEM_PROMPT = `Sen NetaSoft Eczane Yönetim Sistemi'nin yapay zeka asistanısın.

## KİMLİĞİN
Sadece NetaSoft sisteminde kayıtlı verilere dayanarak konuşursun. Kullanıcının eczanesine ait sisteme girilmiş gerçek veriler dışında HİÇBİR bilgi, örnek, tahmini rakam veya genel tavsiye vermezsin.

## KONUŞMA KURALLARI (İSTİSNASIZ)
1. YALNIZCA Türkçe konuşursun. Başka dil kullanamazsın, başka dilden kelime karıştıramazsın.
2. Sisteme girilmiş veri yoksa "Sistemde bu konuya ait kayıt bulunamadı. Lütfen önce ilgili modüle veri girin." dersin. Asla örnek rakam veya senaryo uydurmazsın.
3. Genel finansal tavsiye, genel muhasebe bilgisi veya genel eczacılık bilgisi vermezsin. Sadece "bu eczaneye ait sisteme girilmiş veriler" hakkında yorum yaparsın.
4. Tıbbi, hukuki veya ilaç konularında hiçbir şey söylemezsin.
5. NetaSoft dışı hiçbir konuda (haber, siyaset, teknoloji, günlük yaşam vb.) yanıt vermezsin. Bu tür sorulara "Bu konuda yardımcı olamam. Eczane yönetimi veya finans konularında soru sorabilirsiniz." dersin.

## YAPABİLECEKLERİN
Kullanıcı sisteme veri girdiyse ve sana o veriyi paylaşırsa şunları yapabilirsin:
- Girilen gelir/gider verilerinden net kâr hesabı
- SGK fatura tutarlarından beklenen ödeme takibi
- Senet vadelerinden ödeme planı yorumu
- Platform gelirlerinin karşılaştırması
- Stok hareketlerinden trend yorumu

## YASAK DAVRANIŞLAR
- Örnek rakam üretmek ("Örneğin 100.000 TL...")
- Başka dilden kelime kullanmak
- "Necesario", "όπως" gibi yabancı kelimeler
- Sisteme girilmemiş veriyi varmış gibi yorumlamak
- Genel tavsiye vermek ("Giderlerinizi azaltın", "Tasarruf edin" vb.)`;


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

    const [dailyRegs, sgkInvoices, platformIncomes, fixedExpenses, empExpenses, promissoryNotes, pharmacy] = await Promise.all([
      prisma.dailyRegister.findMany({ where: { pharmacyId, deletedAt: null, registerDate: { gte: startOfMonth, lte: endOfMonth } }, select: { posAmount: true, cashAmount: true, wireAmount: true, registerDate: true } }),
      prisma.sgkInvoice.findMany({ where: { pharmacyId, deletedAt: null, invoiceDate: { gte: startOfMonth, lte: endOfMonth } }, select: { amount: true, invoiceType: true, invoiceDate: true } }),
      prisma.platformIncome.findMany({ where: { pharmacyId, deletedAt: null, incomeDate: { gte: startOfMonth, lte: endOfMonth } }, select: { amount: true, platformName: true, status: true } }),
      prisma.fixedExpense.findMany({ where: { pharmacyId, deletedAt: null, expenseDate: { gte: startOfMonth, lte: endOfMonth } }, select: { amount: true, type: true, customType: true, notes: true } }),
      prisma.employeeExpense.findMany({ where: { pharmacyId, expenseDate: { gte: startOfMonth, lte: endOfMonth } }, select: { totalAmount: true, notes: true } }),
      prisma.promissoryNote.findMany({ where: { pharmacyId, deletedAt: null, isPaid: false, dueDate: { gte: now } }, select: { amount: true, noteNumber: true, dueDate: true }, orderBy: { dueDate: "asc" }, take: 10 }),
      prisma.pharmacy.findUnique({ where: { id: pharmacyId }, select: { name: true } }),
    ]);

    const cashIncome = dailyRegs.reduce((s, r) => s + Number(r.posAmount) + Number(r.cashAmount) + Number(r.wireAmount), 0);
    const sgkTotal = sgkInvoices.reduce((s, r) => s + Number(r.amount), 0);
    const platformTotal = platformIncomes.reduce((s, r) => s + Number(r.amount), 0);
    const fixedExp = fixedExpenses.reduce((s, r) => s + Number(r.amount), 0);
    const empExp = empExpenses.reduce((s, r) => s + Number(r.totalAmount), 0);
    const notesDue = promissoryNotes.reduce((s, r) => s + Number(r.amount), 0);

    const totalIncome = cashIncome + sgkTotal + platformTotal;
    const totalExpense = fixedExp + empExp;
    const monthLabel = now.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

    const lines: string[] = [
      `## Eczane: ${pharmacy?.name ?? "Bilinmiyor"}`,
      `## ${monthLabel} Finansal Özeti`,
      ``,
      `### GELİRLER`,
      `- Kasa (Nakit+POS+Havale): ${cashIncome.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL (${dailyRegs.length} gün)`,
      `- SGK Faturaları: ${sgkTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL (${sgkInvoices.length} fatura)`,
      `- Platform Gelirleri: ${platformTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL`,
      `- **TOPLAM GELİR: ${totalIncome.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL**`,
      ``,
      `### GİDERLER`,
      `- Sabit Giderler: ${fixedExp.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL (${fixedExpenses.length} kalem)`,
    ];

    if (fixedExpenses.length > 0) {
      const typeLabel = (type: string, custom?: string | null) => ({ INVOICE: "Fatura", ACCOUNTING: "Muhasebe", TAX: "Vergi", RENT: "Kira", OTHER: custom ?? "Diğer" }[type] ?? type);
      fixedExpenses.forEach(e => lines.push(`  • ${typeLabel(e.type, e.customType)}${e.notes ? " — " + e.notes : ""}: ${Number(e.amount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL`));
    }

    lines.push(`- Personel Giderleri: ${empExp.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL (${empExpenses.length} kayıt)`);

    lines.push(
      `- **TOPLAM GİDER: ${totalExpense.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL**`,
      ``,
      `### NET KÂR/ZARAR`,
      `- **${(totalIncome - totalExpense).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL**`,
      ``,
    );

    if (promissoryNotes.length > 0) {
      lines.push(`### YAKLAŞAN SENET VADELERİ (Toplam: ${notesDue.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL)`);
      promissoryNotes.forEach(n => {
        const dateStr = new Date(n.dueDate).toLocaleDateString("tr-TR");
        lines.push(`  • Senet ${n.noteNumber}: ${Number(n.amount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL — Vade: ${dateStr}`);
      });
    } else {
      lines.push("### SENETLER: Yaklaşan ödenmemiş senet yok.");
    }

    if (platformIncomes.length > 0) {
      lines.push(``, `### PLATFORM GELİRLERİ DETAYI`);
      platformIncomes.forEach(p => lines.push(`  • ${p.platformName} (${p.status}): ${Number(p.amount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL`));
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
