import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";

const envanterRaporuSchema = z.object({
  fileName: z.string().min(1, "Dosya adı gereklidir").max(255),
  items: z.array(z.record(z.string(), z.unknown())),
  summary: z.object({
    totalProducts: z.number(),
    soldProducts: z.number(),
    totalRevenue: z.number(),
    totalCost: z.number(),
    totalProfit: z.number(),
    profitMargin: z.number(),
  }),
});

// Geçmiş listesinde ağır `items` alanı hariç tutulur — sadece özet alanlar döner
const HISTORY_SELECT = {
  id: true,
  fileName: true,
  totalProducts: true,
  soldProducts: true,
  totalRevenue: true,
  totalCost: true,
  totalProfit: true,
  profitMargin: true,
  createdAt: true,
} as const;

export async function GET(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const report = await prisma.inventoryReport.findFirst({
        where: { id, pharmacyId, deletedAt: null },
      });
      if (!report) return apiError(m("notFound", lang), "NOT_FOUND", 404);
      return apiResponse(report);
    }

    const reports = await prisma.inventoryReport.findMany({
      where: { pharmacyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: HISTORY_SELECT,
    });

    return apiResponse(reports);
  } catch (error) {
    console.error("Envanter Raporu GET Error:", error instanceof Error ? error.message : error);
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}

export async function POST(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const body = await req.json();
    const validated = envanterRaporuSchema.parse(body);

    const report = await prisma.inventoryReport.create({
      data: {
        pharmacyId,
        userId: session.user.id,
        fileName: validated.fileName,
        totalProducts: validated.summary.totalProducts,
        soldProducts: validated.summary.soldProducts,
        totalRevenue: validated.summary.totalRevenue,
        totalCost: validated.summary.totalCost,
        totalProfit: validated.summary.totalProfit,
        profitMargin: validated.summary.profitMargin,
        items: validated.items as object,
      },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "CREATE",
      entityType: "InventoryReport",
      entityId: report.id,
      newData: { fileName: report.fileName, totalRevenue: report.totalRevenue, totalProfit: report.totalProfit },
    });

    return apiResponse({ id: report.id }, 201);
  } catch (error) {
    console.error("Envanter Raporu POST Error:", error instanceof Error ? error.message : error);
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message ?? m("validationError", lang), "VALIDATION_ERROR", 400);
    }
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
