import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";
import { logAudit } from "@/lib/audit";

// DELETE /api/v1/finans/kasa/batches/[batchId] — Bu içe aktarma grubuna ait
// TÜM kasa kayıtlarını soft-delete yapar (deletedAt = now()). Satış
// Raporu'ndaki /api/v1/satis/batches/[batchId] ile aynı desen — kullanıcı
// yanlış eşleştirilmiş bir dosyayı tek tek gün gün silmek yerine tek bir
// işlemle geri alabilsin diye. Kritik bir toplu silme işlemi olduğu için
// audit_logs'a yazılır (AGENTS.md madde 5).
export async function DELETE(
  req: Request,
  context: { params: Promise<{ batchId: string }> },
): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: m("unauthorized", lang), code: "UNAUTHORIZED" }, { status: 401 });
    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return NextResponse.json({ success: false, error: m("noPharmacy", lang), code: "NO_PHARMACY" }, { status: 404 });

    const { batchId } = await context.params;
    const importBatchId = decodeURIComponent(batchId);

    const where = { pharmacyId, deletedAt: null, importBatchId };
    const matching = await prisma.dailyRegister.findMany({ where, select: { id: true } });
    if (matching.length === 0) {
      return NextResponse.json({ success: false, error: m("notFound", lang), code: "NOT_FOUND" }, { status: 404 });
    }

    const { count } = await prisma.dailyRegister.updateMany({ where, data: { deletedAt: new Date() } });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "DELETE",
      entityType: "DailyRegisterBatch",
      entityId: importBatchId,
      oldData: { importBatchId, deletedRecordCount: count },
    });

    return NextResponse.json({ success: true, deleted: count });
  } catch {
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}
