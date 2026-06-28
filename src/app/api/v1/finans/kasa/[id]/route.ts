import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const kasaUpdateSchema = z.object({
  registerDate: z.string().optional(),
  posAmount: z.number().min(0).optional(),
  cashAmount: z.number().min(0).optional(),
  wireAmount: z.number().min(0).optional(),
  foreignCurrencyAmount: z.number().min(0).optional(),
  foreignCurrencyType: z.string().optional(),
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
    const validated = kasaUpdateSchema.parse(body);

    // Kaydın bu eczaneye ait olduğunu doğrula
    const existing = await prisma.dailyRegister.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });

    const updateData: any = { ...validated };

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
        return NextResponse.json(
          { error: "Bu tarih için zaten bir kasa kapatma kaydı mevcut." },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.dailyRegister.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Kasa PUT Error:", error);
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

    const existing = await prisma.dailyRegister.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });

    await prisma.dailyRegister.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Kasa DELETE Error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
