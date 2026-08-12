import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiResponse } from "@/lib/utils";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";
import { dayRangeToUtcBounds } from "@/lib/sales/dateRanges";

// GET /api/v1/satis/overlap-check?start=YYYY-MM-DD&end=YYYY-MM-DD — Yeni bir
// dosya kaydedilmeden ÖNCE, bu tarih aralığında zaten kayıtlı (silinmemiş)
// satış kaydı olup olmadığını kontrol eder. Aynı dönemin birden fazla dosyadan
// gelen satışlarla ÇİFT SAYILMASINI önlemek için kullanılan salt-okunur bir
// "önizleme" sorgusudur — hiçbir veri değiştirmez (bkz. AGENTS.md görev notu #3,
// Satış Raporu sayfası handleConfirm akışında kayıttan HEMEN ÖNCE çağrılır).
export async function GET(req: Request): Promise<Response> {
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
    const { start, end } = bounds;

    // `importBatchId`'ye göre gruplayarak hem toplam kayıt sayısını hem de kaç
    // FARKLI önceki yüklemenin (batch) bu aralığa çakıştığını tek sorguda elde
    // ederiz. `importBatchId` NULL olan (eski, toplu yükleme bilgisi taşımayan)
    // kayıtlar da ayrı bir grup olarak sayılır — kullanıcıya "1 önceki yükleme"
    // gibi anlamlı bir sayı gösterebilmek için.
    const grouped = await prisma.saleRecord.groupBy({
      by: ["importBatchId"],
      where: { pharmacyId, deletedAt: null, saleDate: { gte: start, lte: end } },
      _count: { _all: true },
    });

    const count = grouped.reduce((s, g) => s + g._count._all, 0);
    const batchCount = grouped.length;

    return apiResponse({ count, batchCount });
  } catch {
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
