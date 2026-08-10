import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";

const kasaUpdateSchema = z.object({
  registerDate: z.string().optional(),
  posAmount: z.number().min(0).optional(),
  cashAmount: z.number().min(0).optional(),
  wireAmount: z.number().min(0).optional(),
  foreignCurrencyAmount: z.number().min(0).optional(),
  foreignCurrencyType: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const { id } = await params;
    const body = await req.json();
    const validated = kasaUpdateSchema.parse(body);

    // Kaydın bu eczaneye ait olduğunu doğrula
    const existing = await prisma.dailyRegister.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!existing) return apiError(m("notFound", lang), "NOT_FOUND", 404);

    const updateData: {
      posAmount?: number; cashAmount?: number; wireAmount?: number;
      foreignCurrencyAmount?: number; foreignCurrencyType?: string;
      notes?: string | null; registerDate?: Date;
    } = {
      ...(validated.posAmount !== undefined && { posAmount: validated.posAmount }),
      ...(validated.cashAmount !== undefined && { cashAmount: validated.cashAmount }),
      ...(validated.wireAmount !== undefined && { wireAmount: validated.wireAmount }),
      ...(validated.foreignCurrencyAmount !== undefined && { foreignCurrencyAmount: validated.foreignCurrencyAmount }),
      ...(validated.foreignCurrencyType !== undefined && { foreignCurrencyType: validated.foreignCurrencyType }),
      ...(validated.notes !== undefined && { notes: validated.notes }),
    };

    if (validated.registerDate) {
      const dateStr = validated.registerDate.split("T")[0];
      updateData.registerDate = new Date(`${dateStr}T00:00:00.000Z`);

      // Yeni tarihte başka kayıt var mı kontrol et (kendi kaydı hariç)
      const conflict = await prisma.dailyRegister.findFirst({
        where: {
          pharmacyId,
          registerDate: updateData.registerDate,
          deletedAt: null,
          NOT: { id },
        },
      });
      if (conflict) {
        return apiError("Bu tarih için zaten bir kasa kapatma kaydı mevcut.", "DUPLICATE_DATE", 409);
      }
    }

    const updated = await prisma.dailyRegister.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "UPDATE",
      entityType: "DailyRegister",
      entityId: id,
      oldData: existing,
      newData: updated,
    });

    return apiResponse(updated);
  } catch (error) {
    console.error("Kasa PUT Error:", error instanceof Error ? error.message : error);
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message ?? m("validationError", lang), "VALIDATION_ERROR", 400);
    }
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const { id } = await params;

    const existing = await prisma.dailyRegister.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!existing) return apiError(m("notFound", lang), "NOT_FOUND", 404);

    await prisma.dailyRegister.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "DELETE",
      entityType: "DailyRegister",
      entityId: id,
      oldData: existing,
    });

    return apiResponse({ deleted: true });
  } catch (error) {
    console.error("Kasa DELETE Error:", error instanceof Error ? error.message : error);
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
