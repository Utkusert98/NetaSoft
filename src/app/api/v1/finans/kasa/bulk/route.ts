import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";

const rowSchema = z.object({
  registerDate: z.string().datetime(),
  posAmount: z.number().min(0).default(0),
  cashAmount: z.number().min(0).default(0),
  wireAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
});

const bulkSchema = z.object({ rows: z.array(rowSchema).min(1) });

// POST /api/v1/finans/kasa/bulk — Onaylanan Kasa (Z-raporu) satırlarını toplu
// kaydeder. `daily_registers`'ta (pharmacyId, registerDate) benzersiz olduğu
// için — mevcut bir güne ait kayıt varsa o satır SESSİZCE ATLANIR (üzerine
// YAZILMAZ, kullanıcının elle girdiği bir kaydı kazara ezmemek için); hangi
// tarihlerin atlandığı yanıtta `skippedDates` olarak döner ki kullanıcı
// bilsin. Satış Raporu'ndaki "İçe Aktarma Geçmişi" ile aynı denetim
// (audit log) kuralı uygulanır.
export async function POST(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);
    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const body = await req.json();
    const validated = bulkSchema.parse(body);

    const dates = validated.rows.map(r => new Date(r.registerDate.slice(0, 10) + "T00:00:00.000Z"));
    const existing = await prisma.dailyRegister.findMany({
      where: { pharmacyId, deletedAt: null, registerDate: { in: dates } },
      select: { registerDate: true },
    });
    const existingKeys = new Set(existing.map(e => e.registerDate.toISOString().slice(0, 10)));

    const toCreate: Array<{
      pharmacyId: string; registerDate: Date; posAmount: number; cashAmount: number;
      wireAmount: number; notes: string | null;
    }> = [];
    const skippedDates: string[] = [];

    for (const r of validated.rows) {
      const dateKey = r.registerDate.slice(0, 10);
      if (existingKeys.has(dateKey)) {
        skippedDates.push(dateKey);
        continue;
      }
      toCreate.push({
        pharmacyId,
        registerDate: new Date(dateKey + "T00:00:00.000Z"),
        posAmount: r.posAmount,
        cashAmount: r.cashAmount,
        wireAmount: r.wireAmount,
        notes: r.notes ?? null,
      });
    }

    if (toCreate.length > 0) {
      await prisma.dailyRegister.createMany({ data: toCreate });
    }

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "CREATE",
      entityType: "DailyRegisterBatch",
      entityId: `batch_${Date.now()}`,
      newData: { createdCount: toCreate.length, skippedCount: skippedDates.length },
    });

    return apiResponse({ created: toCreate.length, skippedDates }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(translateZod(error.issues[0]?.message ?? "Geçersiz veri", lang), "VALIDATION_ERROR", 422);
    }
    console.error("Kasa Bulk POST Error:", error instanceof Error ? error.message : error);
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
