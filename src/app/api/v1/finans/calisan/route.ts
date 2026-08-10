import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getActivePharmacyId } from "@/lib/pharmacy";
import { getLang, m } from "@/lib/i18n/api-messages";

const employeeSchema = z.object({
  firstName: z.string().min(2, "Ad en az 2 karakter olmalıdır"),
  lastName: z.string().min(2, "Soyad en az 2 karakter olmalıdır"),
  identityNumber: z.string().optional(),
  phone: z.string().optional(),
  startDate: z.string().datetime().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const body = await req.json();
    const validated = employeeSchema.parse(body);

    const employee = await prisma.employee.create({
      data: {
        pharmacyId,
        firstName: validated.firstName,
        lastName: validated.lastName,
        identityNumber: validated.identityNumber || null,
        phone: validated.phone || null,
        startDate: validated.startDate ? new Date(validated.startDate) : null,
      },
    });

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "CREATE",
      entityType: "Employee",
      entityId: employee.id,
      newData: employee,
    });

    return apiResponse(employee, 201);
  } catch (error) {
    console.error("Employee Create Error:", error instanceof Error ? error.message : error);
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

    const employees = await prisma.employee.findMany({
      where: { pharmacyId, deletedAt: null },
      orderBy: { firstName: "asc" },
    });

    return apiResponse(employees);
  } catch (error) {
    console.error("Employee GET Error:", error instanceof Error ? error.message : error);
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
