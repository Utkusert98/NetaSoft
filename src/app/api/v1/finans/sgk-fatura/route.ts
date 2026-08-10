import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { addMonths } from "date-fns";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";

const SGK_INVOICE_TYPES = [
  "GROUP_A",
  "GROUP_B",
  "GROUP_C",
  "SEQ_MOR_TURUNCU",
  "SEQ_ISYERI",
  "SEQ_DIYALIZ",
  "SEQ_ORGAN_NAKLI",
  "SEQ_ONKOLOJI",
  "SEQ_PSIKIYATRI",
  "SEQ_YASLI_BAKIM",
  "SEQ_PALYATIF",
  "SEQ_EVDE_SAGLIK",
  "SEQ_FIZIK_TEDAVI",
  "SEQ_YOL_GIDERI",
] as const;

const sgkSchema = z.object({
  invoiceDate: z.string().min(1, "Fatura tarihi gereklidir"),
  invoiceType: z.enum(SGK_INVOICE_TYPES, { error: "Geçerli bir fatura türü seçiniz" }),
  amount: z.number().min(0.01, "Tutar 0'dan büyük olmalıdır"),
  notes: z.string().optional(),
});

export async function GET(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const invoices = await prisma.sgkInvoice.findMany({
      where: { pharmacyId, deletedAt: null },
      orderBy: { invoiceDate: "desc" },
    });

    return apiResponse(invoices);
  } catch (error) {
    console.error("SGK GET Error:", error instanceof Error ? error.message : error);
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
    const validated = sgkSchema.parse(body);

    const dateStr = validated.invoiceDate.split("T")[0];
    const invoiceDate = new Date(`${dateStr}T00:00:00.000Z`);

    // Ödeme tarihi: fatura ayından 3 ay sonraki ayın 15'i (SGK ödeme kuralı)
    const payMonth = addMonths(new Date(Date.UTC(invoiceDate.getUTCFullYear(), invoiceDate.getUTCMonth(), 1)), 3);
    const expectedPaymentDate = new Date(Date.UTC(payMonth.getUTCFullYear(), payMonth.getUTCMonth(), 15));

    const invoice = await prisma.sgkInvoice.create({
      data: {
        pharmacyId,
        invoiceDate,
        invoiceType: validated.invoiceType,
        amount: validated.amount,
        expectedPaymentDate,
        notes: validated.notes,
      },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "CREATE",
      entityType: "SgkInvoice",
      entityId: invoice.id,
      newData: invoice,
    });

    return apiResponse(invoice, 201);
  } catch (error) {
    console.error("SGK POST Error:", error instanceof Error ? error.message : error);
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message ?? m("validationError", lang), "VALIDATION_ERROR", 400);
    }
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
