import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { addDays } from "date-fns";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";

const platformSchema = z.object({
  platformName: z.string().min(1, "Platform adı gereklidir"),
  amount: z.number().min(0.01, "Tutar 0'dan büyük olmalıdır"),
  incomeDate: z.string().min(1, "Tarih gereklidir"),
  notes: z.string().optional(),
});

async function getPharmacyId(userId: string) {
  const userRole = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return userRole?.pharmacyId ?? null;
}

export async function GET(req: Request) {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: m("unauthorized", lang), code: "UNAUTHORIZED" }, { status: 401 });

    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return NextResponse.json({ success: false, error: m("noPharmacy", lang), code: "NO_PHARMACY" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = { pharmacyId, deletedAt: null };
    if (status && ["PENDING", "RECEIVED", "CANCELLED"].includes(status)) {
      where.status = status;
    }

    const incomes = await prisma.platformIncome.findMany({
      where,
      orderBy: { expectedPaymentDate: "asc" },
    });

    return NextResponse.json({ success: true, data: incomes });
  } catch (error) {
    console.error("Platform GET Error:", error);
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: m("unauthorized", lang), code: "UNAUTHORIZED" }, { status: 401 });

    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return NextResponse.json({ success: false, error: m("noPharmacy", lang), code: "NO_PHARMACY" }, { status: 404 });

    const body = await req.json();
    const validated = platformSchema.parse(body);

    const dateStr = validated.incomeDate.split("T")[0];
    const incomeDate = new Date(`${dateStr}T00:00:00.000Z`);

    // Otomatik hesaplama: girilen tarihten 15 gün sonrası
    const expectedPaymentDate = addDays(incomeDate, 15);

    const income = await prisma.platformIncome.create({
      data: {
        pharmacyId,
        platformName: validated.platformName,
        amount: validated.amount,
        incomeDate,
        expectedPaymentDate,
        notes: validated.notes,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, data: income }, { status: 201 });
  } catch (error) {
    console.error("Platform POST Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: (error as any).errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}
