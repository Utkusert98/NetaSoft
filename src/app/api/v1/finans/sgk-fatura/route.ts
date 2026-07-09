import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { addMonths } from "date-fns";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";

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

async function getPharmacyId(userId: string) {
  const userRole = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return userRole?.pharmacyId ?? null;
}

export async function GET(req: Request) {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: m("unauthorized", lang), code: "UNAUTHORIZED" }, { status: 401 });

    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return NextResponse.json({ success: false, error: m("noPharmacy", lang), code: "NO_PHARMACY" }, { status: 404 });

    const invoices = await prisma.sgkInvoice.findMany({
      where: { pharmacyId, deletedAt: null },
      orderBy: { invoiceDate: "desc" },
    });

    return NextResponse.json({ success: true, data: invoices });
  } catch (error) {
    console.error("SGK GET Error:", error);
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: m("unauthorized", lang), code: "UNAUTHORIZED" }, { status: 401 });

    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return NextResponse.json({ success: false, error: m("noPharmacy", lang), code: "NO_PHARMACY" }, { status: 404 });

    const body = await req.json();
    const validated = sgkSchema.parse(body);

    const dateStr = validated.invoiceDate.split("T")[0];
    const invoiceDate = new Date(`${dateStr}T00:00:00.000Z`);

    // Otomatik hesaplama: fatura tarihinden tam 3 ay sonrası
    const expectedPaymentDate = addMonths(invoiceDate, 3);

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

    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (error) {
    console.error("SGK POST Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: (error as any).errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}
