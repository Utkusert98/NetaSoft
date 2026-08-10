import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { addDays } from "date-fns";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m } from "@/lib/i18n/api-messages";
import type { Prisma } from "@prisma/client";

const platformSchema = z.object({
  platformName: z.string().min(1, "Platform adı gereklidir"),
  amount: z.number().min(0.01, "Tutar 0'dan büyük olmalıdır"),
  incomeDate: z.string().min(1, "Tarih gereklidir"),
  notes: z.string().optional(),
});

async function getPharmacyId(userId: string): Promise<string | null> {
  const userRole = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return userRole?.pharmacyId ?? null;
}

export async function GET(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: Prisma.PlatformIncomeWhereInput = { pharmacyId, deletedAt: null };
    if (status && ["PENDING", "RECEIVED", "CANCELLED"].includes(status)) {
      where.status = status as "PENDING" | "RECEIVED" | "CANCELLED";
    }

    const incomes = await prisma.platformIncome.findMany({
      where,
      orderBy: { expectedPaymentDate: "asc" },
    });

    return apiResponse(incomes);
  } catch (error) {
    console.error("Platform GET Error:", error instanceof Error ? error.message : error);
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}

export async function POST(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const body = await req.json();
    const validated = platformSchema.parse(body);

    const dateStr = validated.incomeDate.split("T")[0];
    const incomeDate = new Date(`${dateStr}T00:00:00.000Z`);

    // Otomatik hesaplama: girilen tarihten 15 gün sonrası
    const expectedPaymentDate = addDays(incomeDate, 15);

    const income = await prisma.platformIncome.create({
      data: {
        pharmacyId,
        platformName: validated.platformName,
        amount: validated.amount,
        incomeDate,
        expectedPaymentDate,
        notes: validated.notes,
        status: "PENDING",
      },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "CREATE",
      entityType: "PlatformIncome",
      entityId: income.id,
      newData: income,
    });

    return apiResponse(income, 201);
  } catch (error) {
    console.error("Platform POST Error:", error instanceof Error ? error.message : error);
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message ?? m("validationError", lang), "VALIDATION_ERROR", 400);
    }
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
