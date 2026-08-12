import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiResponse } from "@/lib/utils";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";

// GET /api/v1/satis/date-range — Bu eczaneye ait TÜM (silinmemiş) SaleRecord
// kayıtlarının `saleDate` alanına göre en küçük/en büyük tarihini ve toplam
// kayıt sayısını döner. Satış Raporu sayfası ilk açıldığında varsayılan tarih
// filtresini gerçek veri aralığına göre ayarlamak için kullanılan hafif bir
// agregat sorgudur — tam kayıt listesini ÇEKMEZ (bkz. AGENTS.md görev notu).
export async function GET(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);
    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const agg = await prisma.saleRecord.aggregate({
      where: { pharmacyId, deletedAt: null },
      _min: { saleDate: true },
      _max: { saleDate: true },
      _count: { _all: true },
    });

    return apiResponse({
      minDate: agg._min.saleDate ? agg._min.saleDate.toISOString() : null,
      maxDate: agg._max.saleDate ? agg._max.saleDate.toISOString() : null,
      count: agg._count._all,
    });
  } catch {
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
