import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { getLang, m } from "@/lib/i18n/api-messages";

const updateSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  identityNumber: z.string().optional(),
  phone: z.string().optional(),
  startDate: z.string().datetime().optional(),
});

async function getPharmacyId(userId: string): Promise<string | null> {
  const role = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return role?.pharmacyId ?? null;
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: m("unauthorized", lang), code: "UNAUTHORIZED" }, { status: 401 });

    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return NextResponse.json({ success: false, error: m("noPharmacy", lang), code: "NO_PHARMACY" }, { status: 404 });

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
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: m("unauthorized", lang), code: "UNAUTHORIZED" }, { status: 401 });

    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return NextResponse.json({ success: false, error: m("noPharmacy", lang), code: "NO_PHARMACY" }, { status: 404 });

    const { id } = await context.params;
    const record = await prisma.employee.findFirst({ where: { id, pharmacyId } });
    if (!record) return NextResponse.json({ success: false, error: m("notFound", lang), code: "NOT_FOUND" }, { status: 404 });

    const body = await req.json();
    const validated = updateSchema.parse(body);

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...(validated.firstName !== undefined && { firstName: validated.firstName }),
        ...(validated.lastName !== undefined && { lastName: validated.lastName }),
        ...(validated.identityNumber !== undefined && { identityNumber: validated.identityNumber }),
        ...(validated.phone !== undefined && { phone: validated.phone }),
        ...(validated.startDate !== undefined && { startDate: new Date(validated.startDate) }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}
