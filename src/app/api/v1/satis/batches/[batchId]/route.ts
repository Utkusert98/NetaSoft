import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";
import { logAudit } from "@/lib/audit";

// "_none_" özel değeri, `importBatchId` alanı NULL olan (toplu yükleme bilgisi
// taşımayan) eski kayıtlar bucket'ını temsil eder — URL path'inde gerçek NULL
// gönderilemediği için bu sabit kullanılır.
const NONE_BUCKET = "_none_";

// DELETE /api/v1/satis/batches/[batchId] — Bu içe aktarma grubuna ait TÜM satış
// kayıtlarını soft-delete yapar (deletedAt = now()). Kritik bir toplu silme
// işlemi olduğu için audit_logs'a yazılır (AGENTS.md madde 5).
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
    const decoded = decodeURIComponent(batchId);
    const importBatchId = decoded === NONE_BUCKET ? null : decoded;

    const where = { pharmacyId, deletedAt: null, importBatchId };
    const matching = await prisma.saleRecord.findMany({ where, select: { id: true } });
    if (matching.length === 0) {
      return NextResponse.json({ success: false, error: m("notFound", lang), code: "NOT_FOUND" }, { status: 404 });
    }

    const { count } = await prisma.saleRecord.updateMany({ where, data: { deletedAt: new Date() } });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "DELETE",
      entityType: "SaleRecordBatch",
      entityId: decoded,
      oldData: { importBatchId, deletedRecordCount: count },
    });

    return NextResponse.json({ success: true, deleted: count });
  } catch {
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}
