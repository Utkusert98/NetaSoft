import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { getLang, m } from "@/lib/i18n/api-messages";

const updateSchema = z.object({
  type: z.enum(["INVOICE", "ACCOUNTING", "TAX", "RENT", "OTHER"]).optional(),
  customType: z.string().optional(),
  amount: z.number().min(0.01).optional(),
  expenseDate: z.string().datetime().optional(),
  notes: z.string().optional(),
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

    const record = await prisma.fixedExpense.findFirst({
      where: { id, pharmacyId, deletedAt: null },
    });
    if (!record) return NextResponse.json({ success: false, error: m("notFound", lang), code: "NOT_FOUND" }, { status: 404 });

    await prisma.fixedExpense.update({
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
    const record = await prisma.fixedExpense.findFirst({ where: { id, pharmacyId, deletedAt: null } });
    if (!record) return NextResponse.json({ success: false, error: m("notFound", lang), code: "NOT_FOUND" }, { status: 404 });

    const body = await req.json();
    const validated = updateSchema.parse(body);

    const updated = await prisma.fixedExpense.update({
      where: { id },
      data: {
        ...(validated.type !== undefined && { type: validated.type, customType: validated.type === "OTHER" ? validated.customType : null }),
        ...(validated.amount !== undefined && { amount: validated.amount }),
        ...(validated.expenseDate !== undefined && { expenseDate: new Date(validated.expenseDate) }),
        ...(validated.notes !== undefined && { notes: validated.notes }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}
