import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getActivePharmacyId } from "@/lib/pharmacy";
import { getLang, m } from "@/lib/i18n/api-messages";

const employeeExpenseSchema = z.object({
  employeeId: z.string().min(1, "Personel seçilmelidir"),
  expenseDate: z.string().datetime(),
  salaryAmount: z.number().min(0, "Maaş negatif olamaz").default(0),
  sgkAmount: z.number().min(0, "SGK negatif olamaz").default(0),
  foodAmount: z.number().min(0, "Yemek negatif olamaz").default(0),
  transportAmount: z.number().min(0, "Yol negatif olamaz").default(0),
  notes: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const body = await req.json();
    const validated = employeeExpenseSchema.parse(body);

    const totalAmount = validated.salaryAmount + validated.sgkAmount + validated.foodAmount + validated.transportAmount;

    if (totalAmount <= 0) {
      return apiError("Toplam gider tutarı 0'dan büyük olmalıdır", "INVALID_TOTAL_AMOUNT", 400);
    }

    // Check if employee exists and belongs to pharmacy
    const employee = await prisma.employee.findFirst({
      where: { id: validated.employeeId, pharmacyId },
    });

    if (!employee) return apiError("Personel bulunamadı", "EMPLOYEE_NOT_FOUND", 404);

    const expense = await prisma.employeeExpense.create({
      data: {
        pharmacyId,
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

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "CREATE",
      entityType: "EmployeeExpense",
      entityId: expense.id,
      newData: expense,
    });

    return apiResponse(expense, 201);
  } catch (error) {
    console.error("Employee Expense Create Error:", error instanceof Error ? error.message : error);
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message ?? m("validationError", lang), "VALIDATION_ERROR", 400);
    }
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}

export async function GET(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const expenses = await prisma.employeeExpense.findMany({
      where: { pharmacyId, deletedAt: null },
      include: {
        employee: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { expenseDate: "desc" },
    });

    return apiResponse(expenses);
  } catch (error) {
    console.error("Employee Expense GET Error:", error instanceof Error ? error.message : error);
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
