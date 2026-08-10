import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";

const schema = z.object({
  supplierName: z.string().min(1, "Depo adı gereklidir"),
  amount: z.number().min(0.01, "Tutar 0'dan büyük olmalıdır"),
  transferDate: z.string().datetime(),
  notes: z.string().optional(),
});

export async function GET(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);
    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const transfers = await prisma.supplierTransfer.findMany({
      where: { pharmacyId, deletedAt: null },
      orderBy: { transferDate: "desc" },
    });

    return apiResponse(transfers);
  } catch {
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
    const validated = schema.parse(body);

    const transfer = await prisma.supplierTransfer.create({
      data: {
        pharmacyId,
        supplierName: validated.supplierName,
        amount: validated.amount,
        transferDate: new Date(validated.transferDate),
        notes: validated.notes,
      },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "CREATE",
      entityType: "SupplierTransfer",
      entityId: transfer.id,
      newData: transfer,
    });

    return apiResponse(transfer, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message ?? m("validationError", lang), "VALIDATION_ERROR", 400);
    }
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
