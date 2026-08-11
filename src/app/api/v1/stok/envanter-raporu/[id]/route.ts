import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiResponse } from "@/lib/utils";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";
import { logAudit } from "@/lib/audit";

// DELETE /api/v1/stok/envanter-raporu/[id] — Kayıtlı envanter raporunu soft-delete
// yapar (deletedAt = now()). Kritik bir silme işlemi olduğu için audit_logs'a yazılır.
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);
    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const { id } = await context.params;
    const report = await prisma.inventoryReport.findFirst({ where: { id, pharmacyId, deletedAt: null } });
    if (!report) return apiError(m("notFound", lang), "NOT_FOUND", 404);

    await prisma.inventoryReport.update({ where: { id }, data: { deletedAt: new Date() } });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "DELETE",
      entityType: "InventoryReport",
      entityId: id,
      oldData: { fileName: report.fileName, totalRevenue: report.totalRevenue },
    });

    return apiResponse({ deleted: true });
  } catch (error) {
    console.error("Envanter Raporu DELETE Error:", error instanceof Error ? error.message : error);
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
