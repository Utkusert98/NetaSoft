import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";

const employeeExpenseSchema = z.object({
  employeeId: z.string().min(1, "Personel seçilmelidir"),
  expenseDate: z.string().datetime(),
  salaryAmount: z.number().min(0, "Maaş negatif olamaz").default(0),
  sgkAmount: z.number().min(0, "SGK negatif olamaz").default(0),
  foodAmount: z.number().min(0, "Yemek negatif olamaz").default(0),
  transportAmount: z.number().min(0, "Yol negatif olamaz").default(0),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: m("unauthorized", lang), code: "UNAUTHORIZED" }, { status: 401 });

    const userRole = await prisma.userPharmacyRole.findFirst({
      where: { userId: session.user.id },
      select: { pharmacyId: true },
    });

    if (!userRole) return NextResponse.json({ success: false, error: m("noPharmacy", lang), code: "NO_PHARMACY" }, { status: 404 });

    const body = await req.json();
    const validated = employeeExpenseSchema.parse(body);

    const totalAmount = validated.salaryAmount + validated.sgkAmount + validated.foodAmount + validated.transportAmount;

    if (totalAmount <= 0) {
      return NextResponse.json({ error: "Toplam gider tutarı 0'dan büyük olmalıdır" }, { status: 400 });
    }

    // Check if employee exists and belongs to pharmacy
    const employee = await prisma.employee.findFirst({
      where: { id: validated.employeeId, pharmacyId: userRole.pharmacyId },
    });

    if (!employee) return NextResponse.json({ error: "Personel bulunamadı" }, { status: 404 });

    const expense = await prisma.employeeExpense.create({
      data: {
        pharmacyId: userRole.pharmacyId,
        employeeId: validated.employeeId,
        expenseDate: new Date(validated.expenseDate),
        salaryAmount: validated.salaryAmount,
        sgkAmount: validated.sgkAmount,
        foodAmount: validated.foodAmount,
        transportAmount: validated.transportAmount,
        totalAmount,
        notes: validated.notes,
      },
    });

    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (error) {
    console.error("Employee Expense Create Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: (error as any).errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: m("unauthorized", lang), code: "UNAUTHORIZED" }, { status: 401 });

    const userRole = await prisma.userPharmacyRole.findFirst({
      where: { userId: session.user.id },
      select: { pharmacyId: true },
    });

    if (!userRole) return NextResponse.json({ success: false, error: m("noPharmacy", lang), code: "NO_PHARMACY" }, { status: 404 });

    const expenses = await prisma.employeeExpense.findMany({
      where: { pharmacyId: userRole.pharmacyId, deletedAt: null },
      include: {
        employee: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { expenseDate: "desc" },
    });

    return NextResponse.json({ success: true, data: expenses });
  } catch (error) {
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}
