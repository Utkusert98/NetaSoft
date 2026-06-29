import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { addDays } from "date-fns";

const platformUpdateSchema = z.object({
  platformName: z.string().min(1).optional(),
  amount: z.number().min(0.01).optional(),
  incomeDate: z.string().optional(),
  status: z.enum(["PENDING", "RECEIVED", "CANCELLED"]).optional(),
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
    const validated = platformUpdateSchema.parse(body);

    const existing = await prisma.platformIncome.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });

    const dateFields: { incomeDate?: Date; expectedPaymentDate?: Date } = {};
    if (validated.incomeDate) {
      const dateStr = validated.incomeDate.split("T")[0];
      dateFields.incomeDate = new Date(`${dateStr}T00:00:00.000Z`);
      dateFields.expectedPaymentDate = addDays(dateFields.incomeDate, 15);
    }

    const updated = await prisma.platformIncome.update({
      where: { id },
      data: {
        ...(validated.platformName !== undefined && { platformName: validated.platformName }),
        ...(validated.amount !== undefined && { amount: validated.amount }),
        ...(validated.status !== undefined && { status: validated.status }),
        ...(validated.notes !== undefined && { notes: validated.notes }),
        ...dateFields,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Platform PUT Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
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

    const existing = await prisma.platformIncome.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });

    await prisma.platformIncome.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Platform DELETE Error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
