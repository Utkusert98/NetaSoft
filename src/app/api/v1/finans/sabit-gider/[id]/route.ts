import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";

const updateSchema = z.object({
  type: z.enum(["INVOICE", "ACCOUNTING", "TAX", "RENT", "OTHER"]).optional(),
  customType: z.string().optional(),
  amount: z.number().min(0.01).optional(),
  expenseDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const { id } = await context.params;

    const record = await prisma.fixedExpense.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!record) return apiError(m("notFound", lang), "NOT_FOUND", 404);

    await prisma.fixedExpense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "DELETE",
      entityType: "FixedExpense",
      entityId: id,
      oldData: record,
    });

    return apiResponse({ deleted: true });
  } catch {
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const { id } = await context.params;
    const record = await prisma.fixedExpense.findFirst({ where: { id, pharmacyId, deletedAt: null } });
    if (!record) return apiError(m("notFound", lang), "NOT_FOUND", 404);

    const body = await req.json();
    const validated = updateSchema.parse(body);

    const updated = await prisma.fixedExpense.update({
      where: { id },
      data: {
        ...(validated.type !== undefined && { type: validated.type, customType: validated.type === "OTHER" ? validated.customType : null }),
        ...(validated.amount !== undefined && { amount: validated.amount }),
        ...(validated.expenseDate !== undefined && { expenseDate: new Date(validated.expenseDate) }),
        ...(validated.notes !== undefined && { notes: validated.notes }),
      },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "UPDATE",
      entityType: "FixedExpense",
      entityId: id,
      oldData: record,
      newData: updated,
    });

    return apiResponse(updated);
  } catch {
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
