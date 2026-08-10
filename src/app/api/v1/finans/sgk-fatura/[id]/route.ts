import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { addMonths } from "date-fns";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m } from "@/lib/i18n/api-messages";
import type { Prisma } from "@prisma/client";
import { getActivePharmacyId } from "@/lib/pharmacy";

const SGK_INVOICE_TYPES = [
  "GROUP_A", "GROUP_B", "GROUP_C",
  "SEQ_MOR_TURUNCU", "SEQ_ISYERI", "SEQ_DIYALIZ", "SEQ_ORGAN_NAKLI",
  "SEQ_ONKOLOJI", "SEQ_PSIKIYATRI", "SEQ_YASLI_BAKIM", "SEQ_PALYATIF",
  "SEQ_EVDE_SAGLIK", "SEQ_FIZIK_TEDAVI", "SEQ_YOL_GIDERI",
] as const;

const sgkUpdateSchema = z.object({
  invoiceDate: z.string().optional(),
  invoiceType: z.enum(SGK_INVOICE_TYPES).optional(),
  amount: z.number().min(0.01).optional(),
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
    const validated = sgkUpdateSchema.parse(body);

    const existing = await prisma.sgkInvoice.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!existing) return apiError(m("notFound", lang), "NOT_FOUND", 404);

    const updateData: Prisma.SgkInvoiceUpdateInput = { ...validated };

    if (validated.invoiceDate) {
      const dateStr = validated.invoiceDate.split("T")[0];
      const invoiceDate = new Date(`${dateStr}T00:00:00.000Z`);
      updateData.invoiceDate = invoiceDate;
      // Fatura ayından 3 ay sonraki ayın 15'i (POST route ile aynı kural)
      const payMonth = addMonths(new Date(Date.UTC(invoiceDate.getUTCFullYear(), invoiceDate.getUTCMonth(), 1)), 3);
      updateData.expectedPaymentDate = new Date(Date.UTC(payMonth.getUTCFullYear(), payMonth.getUTCMonth(), 15));
    }

    const updated = await prisma.sgkInvoice.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "UPDATE",
      entityType: "SgkInvoice",
      entityId: id,
      oldData: existing,
      newData: updated,
    });

    return apiResponse(updated);
  } catch (error) {
    console.error("SGK PUT Error:", error instanceof Error ? error.message : error);
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

    const existing = await prisma.sgkInvoice.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!existing) return apiError(m("notFound", lang), "NOT_FOUND", 404);

    await prisma.sgkInvoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "DELETE",
      entityType: "SgkInvoice",
      entityId: id,
      oldData: existing,
    });

    return apiResponse({ deleted: true });
  } catch (error) {
    console.error("SGK DELETE Error:", error instanceof Error ? error.message : error);
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
