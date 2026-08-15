import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";
import { logAudit } from "@/lib/audit";

// DELETE /api/v1/finans/sabit-gider/recurring/[recurringId] — Bu "Düzenli
// Ödeme" serisine ait TÜM sabit gider kayıtlarını soft-delete yapar
// (deletedAt = now()). Kasa'daki /api/v1/finans/kasa/batches/[batchId] ile
// aynı desen — kullanıcı sözleşme değişince/bittiğinde tek tek ay ay
// silmek yerine tüm seriyi tek işlemle geri alabilsin diye.
export async function DELETE(
  req: Request,
  context: { params: Promise<{ recurringId: string }> },
): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: m("unauthorized", lang), code: "UNAUTHORIZED" }, { status: 401 });
    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return NextResponse.json({ success: false, error: m("noPharmacy", lang), code: "NO_PHARMACY" }, { status: 404 });

    const { recurringId: rawRecurringId } = await context.params;
    const recurringId = decodeURIComponent(rawRecurringId);

    const where = { pharmacyId, deletedAt: null, recurringId };
    const matching = await prisma.fixedExpense.findMany({ where, select: { id: true } });
    if (matching.length === 0) {
      return NextResponse.json({ success: false, error: m("notFound", lang), code: "NOT_FOUND" }, { status: 404 });
    }

    const { count } = await prisma.fixedExpense.updateMany({ where, data: { deletedAt: new Date() } });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "DELETE",
      entityType: "FixedExpenseRecurring",
      entityId: recurringId,
      oldData: { recurringId, deletedRecordCount: count },
    });

    return NextResponse.json({ success: true, deleted: count });
  } catch {
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}
