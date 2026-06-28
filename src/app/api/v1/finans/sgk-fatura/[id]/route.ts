import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { addMonths } from "date-fns";

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

async function getPharmacyId(userId: string) {
  const userRole = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return userRole?.pharmacyId ?? null;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return NextResponse.json({ error: "Eczane bulunamadı" }, { status: 404 });

    const { id } = await params;
    const body = await req.json();
    const validated = sgkUpdateSchema.parse(body);

    const existing = await prisma.sgkInvoice.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });

    const updateData: any = { ...validated };

    if (validated.invoiceDate) {
      const dateStr = validated.invoiceDate.split("T")[0];
      updateData.invoiceDate = new Date(`${dateStr}T00:00:00.000Z`);
      updateData.expectedPaymentDate = addMonths(updateData.invoiceDate, 3);
    }

    const updated = await prisma.sgkInvoice.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("SGK PUT Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: (error as any).errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return NextResponse.json({ error: "Eczane bulunamadı" }, { status: 404 });

    const { id } = await params;

    const existing = await prisma.sgkInvoice.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });

    await prisma.sgkInvoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SGK DELETE Error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
