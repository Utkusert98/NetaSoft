import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiResponse } from "@/lib/utils";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";
import { logAudit } from "@/lib/audit";
import { dayRangeToUtcBounds } from "@/lib/sales/dateRanges";

// DELETE /api/v1/satis/overlap?start=YYYY-MM-DD&end=YYYY-MM-DD — Bu tarih
// aralığındaki TÜM (hangi importBatchId'den geldiğine bakılmaksızın) mevcut
// (silinmemiş) satış kayıtlarını soft-delete yapar. Kullanıcı, yeni yüklenen
// bir dosyanın tarih aralığı önceden kaydedilmiş bir aralıkla ÇAKIŞTIĞINDA
// gösterilen onay diyaloğunda "eski kayıtları sil, yeni dosyayı kaydet"
// seçeneğini seçtiğinde çağrılır (bkz. satis/rapor sayfası handleConfirm /
// handleOverlapDeleteAndSave). Kritik bir toplu finansal silme işlemi olduğu
// için audit_logs'a yazılır (AGENTS.md madde 5, batches/[batchId] ile aynı desen).
export async function DELETE(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);
    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    if (!startParam || !endParam) {
      return apiError(m("validationError", lang), "VALIDATION_ERROR", 400);
    }

    const bounds = dayRangeToUtcBounds(startParam, endParam);
    if (!bounds) {
      return apiError(m("validationError", lang), "VALIDATION_ERROR", 400);
    }

    const where = { pharmacyId, deletedAt: null, saleDate: { gte: bounds.start, lte: bounds.end } };
    const { count } = await prisma.saleRecord.updateMany({ where, data: { deletedAt: new Date() } });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "DELETE",
      entityType: "SaleRecordOverlap",
      entityId: `${startParam.slice(0, 10)}_${endParam.slice(0, 10)}`,
      oldData: { start: startParam.slice(0, 10), end: endParam.slice(0, 10), deletedRecordCount: count },
    });

    return apiResponse({ deleted: count });
  } catch {
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
