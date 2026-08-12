import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiResponse } from "@/lib/utils";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";
import { logAudit } from "@/lib/audit";

export async function DELETE(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);
    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const { count } = await prisma.saleRecord.updateMany({
      where: { pharmacyId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    // Eczanenin TÜM satış kayıtlarını silen kritik bir toplu işlem — daha
    // önce audit_logs'a hiç yazılmıyordu (AGENTS.md madde 5, bir kullanıcı
    // denetimiyle tespit edildi).
    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "DELETE",
      entityType: "SaleRecordBatch",
      entityId: "ALL",
      oldData: { deletedRecordCount: count },
    });

    return apiResponse({ deleted: count });
  } catch {
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
