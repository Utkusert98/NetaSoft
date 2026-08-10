import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m } from "@/lib/i18n/api-messages";

const updateSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  identityNumber: z.string().optional(),
  phone: z.string().optional(),
  startDate: z.string().datetime().optional(),
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

    const record = await prisma.employee.findFirst({
      where: { id, pharmacyId },
    });
    if (!record) return apiError("Personel bulunamadı", "EMPLOYEE_NOT_FOUND", 404);

    // Soft delete — çalışana bağlı giderler korunur
    await prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "DELETE",
      entityType: "Employee",
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
    const record = await prisma.employee.findFirst({ where: { id, pharmacyId } });
    if (!record) return apiError(m("notFound", lang), "NOT_FOUND", 404);

    const body = await req.json();
    const validated = updateSchema.parse(body);

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...(validated.firstName !== undefined && { firstName: validated.firstName }),
        ...(validated.lastName !== undefined && { lastName: validated.lastName }),
        ...(validated.identityNumber !== undefined && { identityNumber: validated.identityNumber }),
        ...(validated.phone !== undefined && { phone: validated.phone }),
        ...(validated.startDate !== undefined && { startDate: new Date(validated.startDate) }),
      },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "UPDATE",
      entityType: "Employee",
      entityId: id,
      oldData: record,
      newData: updated,
    });

    return apiResponse(updated);
  } catch {
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
