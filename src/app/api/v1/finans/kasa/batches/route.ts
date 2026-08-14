import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiResponse } from "@/lib/utils";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";

// GET /api/v1/finans/kasa/batches — Kasa içe aktarma geçmişini importBatchId'ye
// göre gruplanmış olarak döner (Satış Raporu'ndaki /api/v1/satis/batches ile
// aynı desen). `importBatchId` NULL olan (bulk yükleme dışında tek tek girilen
// veya bu alan eklenmeden önceki eski) kayıtlar ayrı bir "null" grup olarak
// döner; istemci bunu "Toplu içe aktarma bilgisi olmayan kayıtlar" başlığıyla
// gösterir.
export async function GET(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);
    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const grouped = await prisma.dailyRegister.groupBy({
      by: ["importBatchId", "fileName"],
      where: { pharmacyId, deletedAt: null, importBatchId: { not: null } },
      _count: { _all: true },
      _min: { createdAt: true, registerDate: true },
      _max: { registerDate: true },
      _sum: { posAmount: true, cashAmount: true, wireAmount: true },
    });

    const batches = grouped
      .map(g => ({
        importBatchId: g.importBatchId,
        fileName: g.fileName,
        importDate: g._min.createdAt?.toISOString() ?? null,
        recordCount: g._count._all,
        dateRangeStart: g._min.registerDate?.toISOString() ?? null,
        dateRangeEnd: g._max.registerDate?.toISOString() ?? null,
        totalAmount: Number(g._sum.posAmount ?? 0) + Number(g._sum.cashAmount ?? 0) + Number(g._sum.wireAmount ?? 0),
      }))
      .sort((a, b) => (b.importDate ?? "").localeCompare(a.importDate ?? ""));

    return apiResponse({ batches });
  } catch {
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
