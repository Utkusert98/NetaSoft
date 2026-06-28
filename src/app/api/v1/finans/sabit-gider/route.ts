import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const fixedExpenseSchema = z.object({
  type: z.enum(["INVOICE", "ACCOUNTING", "TAX", "RENT", "OTHER"]),
  customType: z.string().optional(),
  amount: z.number().min(0.01, "Tutar 0'dan büyük olmalıdır"),
  expenseDate: z.string().datetime(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const userRole = await prisma.userPharmacyRole.findFirst({
      where: { userId: session.user.id },
      select: { pharmacyId: true },
    });

    if (!userRole) {
      return NextResponse.json({ error: "Eczane bulunamadı" }, { status: 404 });
    }

    const body = await req.json();
    const validated = fixedExpenseSchema.parse(body);

    const expense = await prisma.fixedExpense.create({
      data: {
        pharmacyId: userRole.pharmacyId,
        type: validated.type,
        customType: validated.type === "OTHER" ? validated.customType : null,
        amount: validated.amount,
        expenseDate: new Date(validated.expenseDate),
        notes: validated.notes,
      },
    });

    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (error) {
    console.error("Fixed Expense Create Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: (error as any).errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const userRole = await prisma.userPharmacyRole.findFirst({
      where: { userId: session.user.id },
      select: { pharmacyId: true },
    });

    if (!userRole) return NextResponse.json({ error: "Eczane bulunamadı" }, { status: 404 });

    const expenses = await prisma.fixedExpense.findMany({
      where: { pharmacyId: userRole.pharmacyId, deletedAt: null },
      orderBy: { expenseDate: "desc" },
    });

    return NextResponse.json({ success: true, data: expenses });
  } catch (error) {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
