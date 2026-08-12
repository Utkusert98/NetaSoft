import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiResponse } from "@/lib/utils";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";

// GET /api/v1/satis/batches — Satış içe aktarma geçmişini importBatchId'ye göre
// gruplanmış olarak döner. `importBatchId` alanı NULL olan (eski, toplu yükleme
// bilgisi taşımayan) kayıtlar ayrı bir "null" grup olarak döner; istemci bunu
// "Toplu içe aktarma bilgisi olmayan eski kayıtlar" başlığıyla gösterir.
export async function GET(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);
    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    // `fileName` `by` içine dahil edilir — aynı importBatchId'ye ait tüm
    // satırlar aynı yükleme çağrısından geldiği için her zaman aynı dosya
    // adını taşır, bu yüzden gruplamayı BÖLMEZ (fiilen importBatchId ile
    // birebir aynı gruplara ayrışır), sadece dosya adını da döndürür.
    const grouped = await prisma.saleRecord.groupBy({
      by: ["importBatchId", "fileName"],
      where: { pharmacyId, deletedAt: null },
      _count: { _all: true },
      _min: { createdAt: true, saleDate: true },
      _max: { saleDate: true },
      _sum: { netRevenue: true },
    });

    const batches = grouped
      .map(g => ({
        importBatchId: g.importBatchId,
        fileName: g.fileName,
        importDate: g._min.createdAt?.toISOString() ?? null,
        recordCount: g._count._all,
        dateRangeStart: g._min.saleDate?.toISOString() ?? null,
        dateRangeEnd: g._max.saleDate?.toISOString() ?? null,
        totalRevenue: Number(g._sum.netRevenue ?? 0),
      }))
      .sort((a, b) => (b.importDate ?? "").localeCompare(a.importDate ?? ""));

    return apiResponse({ batches });
  } catch {
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
