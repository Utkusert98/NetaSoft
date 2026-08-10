import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m } from "@/lib/i18n/api-messages";

const updateSchema = z.object({
  amount: z.number().min(0.01).optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  isPaid: z.boolean().optional(),
});

async function getPharmacyId(userId: string): Promise<string | null> {
  const role = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return role?.pharmacyId ?? null;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const { id } = await context.params;
    const body = await req.json();
    const validated = updateSchema.parse(body);

    const note = await prisma.promissoryNote.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!note) return apiError("Senet bulunamadı", "NOTE_NOT_FOUND", 404);

    const updated = await prisma.promissoryNote.update({
      where: { id },
      data: {
        ...(validated.amount !== undefined && { amount: validated.amount }),
        ...(validated.dueDate !== undefined && { dueDate: new Date(validated.dueDate) }),
        ...(validated.notes !== undefined && { notes: validated.notes }),
        ...(validated.isPaid !== undefined && {
          isPaid: validated.isPaid,
          paidDate: validated.isPaid ? new Date() : null,
        }),
      },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "UPDATE",
      entityType: "PromissoryNote",
      entityId: id,
      oldData: note,
      newData: updated,
    });

    return apiResponse(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message ?? m("validationError", lang), "VALIDATION_ERROR", 400);
    }
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const { id } = await context.params;

    const note = await prisma.promissoryNote.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!note) return apiError("Senet bulunamadı", "NOTE_NOT_FOUND", 404);

    await prisma.promissoryNote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "DELETE",
      entityType: "PromissoryNote",
      entityId: id,
      oldData: note,
    });

    return apiResponse({ deleted: true });
  } catch {
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
