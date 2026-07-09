import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";

const employeeSchema = z.object({
  firstName: z.string().min(2, "Ad en az 2 karakter olmalıdır"),
  lastName: z.string().min(2, "Soyad en az 2 karakter olmalıdır"),
  identityNumber: z.string().optional(),
  phone: z.string().optional(),
  startDate: z.string().datetime().optional(),
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
    const validated = employeeSchema.parse(body);

    const employee = await prisma.employee.create({
      data: {
        pharmacyId: userRole.pharmacyId,
        firstName: validated.firstName,
        lastName: validated.lastName,
        identityNumber: validated.identityNumber || null,
        phone: validated.phone || null,
        startDate: validated.startDate ? new Date(validated.startDate) : null,
      },
    });

    return NextResponse.json({ success: true, data: employee }, { status: 201 });
  } catch (error) {
    console.error("Employee Create Error:", error);
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

    const employees = await prisma.employee.findMany({
      where: { pharmacyId: userRole.pharmacyId, deletedAt: null },
      orderBy: { firstName: "asc" },
    });

    return NextResponse.json({ success: true, data: employees });
  } catch (error) {
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}
