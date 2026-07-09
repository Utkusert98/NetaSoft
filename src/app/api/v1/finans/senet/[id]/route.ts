import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";

const updateSchema = z.object({
  amount: z.number().min(0.01).optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  isPaid: z.boolean().optional(),
});

async function getPharmacyId(userId: string): Promise<string | null> {
  const role = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return role?.pharmacyId ?? null;
}

export async function PATCH(
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
    const body = await req.json();
    const validated = updateSchema.parse(body);

    const note = await prisma.promissoryNote.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!note) return NextResponse.json({ error: "Senet bulunamadı" }, { status: 404 });

    const updated = await prisma.promissoryNote.update({
      where: { id },
      data: {
        ...(validated.amount !== undefined && { amount: validated.amount }),
        ...(validated.dueDate !== undefined && { dueDate: new Date(validated.dueDate) }),
        ...(validated.notes !== undefined && { notes: validated.notes }),
        ...(validated.isPaid !== undefined && {
          isPaid: validated.isPaid,
          paidDate: validated.isPaid ? new Date() : null,
        }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: (error as z.ZodError).issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
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

    const note = await prisma.promissoryNote.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!note) return NextResponse.json({ error: "Senet bulunamadı" }, { status: 404 });

    await prisma.promissoryNote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}
