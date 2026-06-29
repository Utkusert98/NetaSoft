import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const schema = z.object({
  supplierName: z.string().min(1, "Depo adı gereklidir"),
  amount: z.number().min(0.01, "Tutar 0'dan büyük olmalıdır"),
  transferDate: z.string().datetime(),
  notes: z.string().optional(),
});

async function getPharmacyId(userId: string): Promise<string | null> {
  const role = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return role?.pharmacyId ?? null;
}

export async function GET(): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return NextResponse.json({ error: "Eczane bulunamadı" }, { status: 404 });

    const transfers = await prisma.supplierTransfer.findMany({
      where: { pharmacyId, deletedAt: null },
      orderBy: { transferDate: "desc" },
    });

    return NextResponse.json({ success: true, data: transfers });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return NextResponse.json({ error: "Eczane bulunamadı" }, { status: 404 });

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

    return NextResponse.json({ success: true, data: transfer }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
