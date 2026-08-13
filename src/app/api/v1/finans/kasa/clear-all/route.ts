import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiResponse } from "@/lib/utils";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";
import { logAudit } from "@/lib/audit";

// DELETE /api/v1/finans/kasa/clear-all?start=YYYY-MM-DD&end=YYYY-MM-DD —
// Kasa (Günlük Z-raporu) kayıtlarını toplu (soft) siler. `start`/`end`
// verilirse yalnızca o tarih ARALIĞINDAKİ kayıtlar silinir (kullanıcının
// arayüzdeki tarih filtresiyle önizlediği kayıtlarla BİREBİR aynı küme) —
// yanlış eşleştirilmiş bir dosyanın sadece ilgili bölümünü, geri kalan
// geçerli kayıtları etkilemeden temizleyebilmek için (bkz. Satış
// Raporu'ndaki /api/v1/satis/clear-all — o endpoint parametre almadan HER
// ZAMAN tümünü siler; Kasa'da tarih aralığı isteğe bağlı yapıldı çünkü
// aynı ekranda zaten bir tarih filtresi var ve kullanıcının hatalı bir
// içe aktarmanın YALNIZCA o bölümünü silmesi gerekebilir).
export async function DELETE(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);
    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    const where: {
      pharmacyId: string; deletedAt: null;
      registerDate?: { gte?: Date; lte?: Date };
    } = { pharmacyId, deletedAt: null };

    if (start || end) {
      where.registerDate = {};
      if (start) where.registerDate.gte = new Date(`${start}T00:00:00.000Z`);
      if (end) where.registerDate.lte = new Date(`${end}T23:59:59.999Z`);
    }

    const { count } = await prisma.dailyRegister.updateMany({
      where,
      data: { deletedAt: new Date() },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "DELETE",
      entityType: "DailyRegisterBatch",
      entityId: start || end ? `RANGE_${start ?? ""}_${end ?? ""}` : "ALL",
      oldData: { deletedRecordCount: count, start, end },
    });

    return apiResponse({ deleted: count });
  } catch (error) {
    console.error("Kasa Clear-All DELETE Error:", error instanceof Error ? error.message : error);
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
