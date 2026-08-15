import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getActivePharmacyId } from "@/lib/pharmacy";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";
import { generateRecurringDates, MAX_RECURRING_DATES } from "@/lib/finans/recurringDates";

const recurringSchema = z.object({
  type: z.enum(["INVOICE", "ACCOUNTING", "TAX", "RENT", "OTHER"]),
  customType: z.string().optional(),
  amount: z.number().min(0.01, "Tutar 0'dan büyük olmalıdır"),
  frequency: z.enum(["MONTHLY", "YEARLY", "DAILY"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  // İstemci üretir (crypto.randomUUID) — bu seriye ait tüm satırları
  // gruplamak için; Kasa'daki importBatchId ile aynı desen. Kullanıcı
  // sözleşme değişince/bittiğinde tüm seriyi tek işlemle geri alabilsin.
  recurringId: z.string().min(1),
});

// POST /api/v1/finans/sabit-gider/recurring — "Düzenli Ödeme": kira, kredi
// kartı borcu gibi sözleşme boyunca sabit tutarlı bir gideri, seçilen
// sıklıkta (aylık/yıllık/günlük) tarih aralığına yayarak tek seferde
// birden fazla FixedExpense satırı olarak oluşturur.
export async function POST(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);
    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const body = await req.json();
    const validated = recurringSchema.parse(body);

    if (validated.startDate > validated.endDate) {
      return apiError(
        lang === "en" ? "Start date must be before the end date." : "Başlangıç tarihi bitiş tarihinden önce olmalıdır.",
        "VALIDATION_ERROR",
        422
      );
    }

    const dates = generateRecurringDates(validated.startDate, validated.endDate, validated.frequency);
    if (dates.length === 0) {
      return apiError(
        lang === "en" ? "No dates could be generated for this range." : "Bu tarih aralığı için hiçbir tarih üretilemedi.",
        "VALIDATION_ERROR",
        422
      );
    }
    if (dates.length > MAX_RECURRING_DATES) {
      return apiError(
        lang === "en"
          ? `This range would create too many entries (limit ${MAX_RECURRING_DATES}). Please narrow the date range.`
          : `Bu tarih aralığı çok fazla kayıt oluşturur (limit ${MAX_RECURRING_DATES}). Lütfen tarih aralığını daraltın.`,
        "VALIDATION_ERROR",
        422
      );
    }

    const { count } = await prisma.fixedExpense.createMany({
      data: dates.map((dateKey) => ({
        pharmacyId,
        type: validated.type,
        customType: validated.type === "OTHER" ? (validated.customType ?? null) : null,
        amount: validated.amount,
        expenseDate: new Date(`${dateKey}T00:00:00.000Z`),
        notes: validated.notes,
        recurringId: validated.recurringId,
      })),
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "CREATE",
      entityType: "FixedExpenseRecurring",
      entityId: validated.recurringId,
      newData: { created: count, frequency: validated.frequency, startDate: validated.startDate, endDate: validated.endDate, amount: validated.amount },
    });

    return apiResponse({ created: count }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(translateZod(error.issues[0]?.message ?? "Geçersiz veri", lang), "VALIDATION_ERROR", 422);
    }
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Sabit Gider Recurring POST Error:", detail);
    return apiError(`${m("serverError", lang)}: ${detail}`, "SERVER_ERROR", 500);
  }
}

// GET /api/v1/finans/sabit-gider/recurring — "Düzenli Ödemeler" geçmişi:
// her seriyi (recurringId) tek satır olarak, toplam kayıt sayısı/tutarı ve
// tarih aralığıyla özetler.
export async function GET(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);
    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const rows = await prisma.fixedExpense.findMany({
      where: { pharmacyId, deletedAt: null, recurringId: { not: null } },
      select: { recurringId: true, type: true, customType: true, amount: true, expenseDate: true, createdAt: true },
      orderBy: { expenseDate: "asc" },
    });

    const seriesMap = new Map<string, {
      recurringId: string; type: string; customType: string | null;
      count: number; total: number; startDate: string; endDate: string; createdAt: Date;
    }>();
    for (const r of rows) {
      const id = r.recurringId as string;
      const existing = seriesMap.get(id);
      const dateKey = r.expenseDate.toISOString().slice(0, 10);
      if (!existing) {
        seriesMap.set(id, {
          recurringId: id, type: r.type, customType: r.customType,
          count: 1, total: Number(r.amount), startDate: dateKey, endDate: dateKey, createdAt: r.createdAt,
        });
      } else {
        existing.count += 1;
        existing.total += Number(r.amount);
        if (dateKey < existing.startDate) existing.startDate = dateKey;
        if (dateKey > existing.endDate) existing.endDate = dateKey;
      }
    }

    const series = Array.from(seriesMap.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return apiResponse(series);
  } catch {
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
