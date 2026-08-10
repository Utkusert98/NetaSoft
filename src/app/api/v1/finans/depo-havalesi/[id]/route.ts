import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m } from "@/lib/i18n/api-messages";

const updateSchema = z.object({
  supplierName: z.string().min(1).optional(),
  amount: z.number().min(0.01).optional(),
  transferDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

async function getPharmacyId(userId: string): Promise<string | null> {
  const role = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return role?.pharmacyId ?? null;
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
    const record = await prisma.supplierTransfer.findFirst({ where: { id, pharmacyId, deletedAt: null } });
    if (!record) return apiError(m("notFound", lang), "NOT_FOUND", 404);

    await prisma.supplierTransfer.update({ where: { id }, data: { deletedAt: new Date() } });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "DELETE",
      entityType: "SupplierTransfer",
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
    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const { id } = await context.params;
    const record = await prisma.supplierTransfer.findFirst({ where: { id, pharmacyId, deletedAt: null } });
    if (!record) return apiError(m("notFound", lang), "NOT_FOUND", 404);

    const body = await req.json();
    const validated = updateSchema.parse(body);

    const updated = await prisma.supplierTransfer.update({
      where: { id },
      data: {
        ...(validated.supplierName !== undefined && { supplierName: validated.supplierName }),
        ...(validated.amount !== undefined && { amount: validated.amount }),
        ...(validated.transferDate !== undefined && { transferDate: new Date(validated.transferDate) }),
        ...(validated.notes !== undefined && { notes: validated.notes }),
      },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "UPDATE",
      entityType: "SupplierTransfer",
      entityId: id,
      oldData: record,
      newData: updated,
    });

    return apiResponse(updated);
  } catch {
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
