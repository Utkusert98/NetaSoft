import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m } from "@/lib/i18n/api-messages";

const fixedExpenseSchema = z.object({
  type: z.enum(["INVOICE", "ACCOUNTING", "TAX", "RENT", "OTHER"]),
  customType: z.string().optional(),
  amount: z.number().min(0.01, "Tutar 0'dan büyük olmalıdır"),
  expenseDate: z.string().datetime(),
  notes: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);
    }

    const userRole = await prisma.userPharmacyRole.findFirst({
      where: { userId: session.user.id },
      select: { pharmacyId: true },
    });

    if (!userRole) {
      return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);
    }

    const body = await req.json();
    const validated = fixedExpenseSchema.parse(body);

    const expense = await prisma.fixedExpense.create({
      data: {
        pharmacyId: userRole.pharmacyId,
        type: validated.type,
        customType: validated.type === "OTHER" ? validated.customType : null,
        amount: validated.amount,
        expenseDate: new Date(validated.expenseDate),
        notes: validated.notes,
      },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId: userRole.pharmacyId,
      action: "CREATE",
      entityType: "FixedExpense",
      entityId: expense.id,
      newData: expense,
    });

    return apiResponse(expense, 201);
  } catch (error) {
    console.error("Fixed Expense Create Error:", error instanceof Error ? error.message : error);
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message ?? m("validationError", lang), "VALIDATION_ERROR", 400);
    }
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}

export async function GET(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const userRole = await prisma.userPharmacyRole.findFirst({
      where: { userId: session.user.id },
      select: { pharmacyId: true },
    });

    if (!userRole) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const expenses = await prisma.fixedExpense.findMany({
      where: { pharmacyId: userRole.pharmacyId, deletedAt: null },
      orderBy: { expenseDate: "desc" },
    });

    return apiResponse(expenses);
  } catch {
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
