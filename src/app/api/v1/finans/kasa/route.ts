import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m } from "@/lib/i18n/api-messages";
import type { Prisma } from "@prisma/client";
import { getActivePharmacyId } from "@/lib/pharmacy";

const kasaSchema = z.object({
  registerDate: z.string().min(1, "Tarih gereklidir"),
  posAmount: z.number().min(0).default(0),
  cashAmount: z.number().min(0).default(0),
  wireAmount: z.number().min(0).default(0),
  foreignCurrencyAmount: z.number().min(0).default(0),
  foreignCurrencyType: z.string().default("USD"),
  notes: z.string().optional(),
});

export async function GET(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    const where: Prisma.DailyRegisterWhereInput = { pharmacyId, deletedAt: null };

    if (year && month) {
      const y = Number(year); const mo = Number(month);
      const mm = String(mo).padStart(2, "0");
      const lastDay = new Date(y, mo, 0).getDate();
      const start = new Date(`${y}-${mm}-01T00:00:00.000Z`);
      const end = new Date(`${y}-${mm}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`);
      where.registerDate = { gte: start, lte: end };
    }

    const records = await prisma.dailyRegister.findMany({
      where,
      orderBy: { registerDate: "desc" },
    });

    return apiResponse(records);
  } catch (error) {
    console.error("Kasa GET Error:", error instanceof Error ? error.message : error);
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}

export async function POST(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const body = await req.json();
    const validated = kasaSchema.parse(body);

    // Tarihi normalize et: sadece yıl-ay-gün al, saat 00:00:00 UTC
    const dateStr = validated.registerDate.split("T")[0];
    const registerDate = new Date(`${dateStr}T00:00:00.000Z`);

    // Aynı tarihe mükerrer kayıt kontrolü
    const existing = await prisma.dailyRegister.findFirst({
      where: { pharmacyId, registerDate, deletedAt: null },
    });

    if (existing) {
      return apiError("Bu tarih için zaten bir kasa kapatma kaydı mevcut. Düzenleme yapabilirsiniz.", "DUPLICATE_DATE", 409);
    }

    const record = await prisma.dailyRegister.create({
      data: {
        pharmacyId,
        registerDate,
        posAmount: validated.posAmount,
        cashAmount: validated.cashAmount,
        wireAmount: validated.wireAmount,
        foreignCurrencyAmount: validated.foreignCurrencyAmount,
        foreignCurrencyType: validated.foreignCurrencyType,
        notes: validated.notes,
      },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "CREATE",
      entityType: "DailyRegister",
      entityId: record.id,
      newData: record,
    });

    return apiResponse(record, 201);
  } catch (error) {
    console.error("Kasa POST Error:", error instanceof Error ? error.message : error);
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message ?? m("validationError", lang), "VALIDATION_ERROR", 400);
    }
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
