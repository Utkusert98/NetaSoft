import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { addDays } from "date-fns";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m } from "@/lib/i18n/api-messages";

const platformUpdateSchema = z.object({
  platformName: z.string().min(1).optional(),
  amount: z.number().min(0.01).optional(),
  incomeDate: z.string().optional(),
  status: z.enum(["PENDING", "RECEIVED", "CANCELLED"]).optional(),
  notes: z.string().optional().nullable(),
});

async function getPharmacyId(userId: string): Promise<string | null> {
  const userRole = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return userRole?.pharmacyId ?? null;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const { id } = await params;
    const body = await req.json();
    const validated = platformUpdateSchema.parse(body);

    const existing = await prisma.platformIncome.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!existing) return apiError(m("notFound", lang), "NOT_FOUND", 404);

    const dateFields: { incomeDate?: Date; expectedPaymentDate?: Date } = {};
    if (validated.incomeDate) {
      const dateStr = validated.incomeDate.split("T")[0];
      dateFields.incomeDate = new Date(`${dateStr}T00:00:00.000Z`);
      dateFields.expectedPaymentDate = addDays(dateFields.incomeDate, 15);
    }

    const updated = await prisma.platformIncome.update({
      where: { id },
      data: {
        ...(validated.platformName !== undefined && { platformName: validated.platformName }),
        ...(validated.amount !== undefined && { amount: validated.amount }),
        ...(validated.status !== undefined && { status: validated.status }),
        ...(validated.notes !== undefined && { notes: validated.notes }),
        ...dateFields,
      },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "UPDATE",
      entityType: "PlatformIncome",
      entityId: id,
      oldData: existing,
      newData: updated,
    });

    return apiResponse(updated);
  } catch (error) {
    console.error("Platform PUT Error:", error instanceof Error ? error.message : error);
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message ?? m("validationError", lang), "VALIDATION_ERROR", 400);
    }
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const { id } = await params;

    const existing = await prisma.platformIncome.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!existing) return apiError(m("notFound", lang), "NOT_FOUND", 404);

    await prisma.platformIncome.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "DELETE",
      entityType: "PlatformIncome",
      entityId: id,
      oldData: existing,
    });

    return apiResponse({ deleted: true });
  } catch (error) {
    console.error("Platform DELETE Error:", error instanceof Error ? error.message : error);
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
