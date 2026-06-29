import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

async function getPharmacyId(userId: string): Promise<string | null> {
  const role = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return role?.pharmacyId ?? null;
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return NextResponse.json({ error: "Eczane bulunamadı" }, { status: 404 });

    const { id } = await context.params;

    const record = await prisma.employee.findFirst({
      where: { id, pharmacyId },
    });
    if (!record) return NextResponse.json({ error: "Personel bulunamadı" }, { status: 404 });

    // Soft delete — çalışana bağlı giderler korunur
    await prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
