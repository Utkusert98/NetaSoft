import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";

const kasaSchema = z.object({
  registerDate: z.string().min(1, "Tarih gereklidir"),
  posAmount: z.number().min(0).default(0),
  cashAmount: z.number().min(0).default(0),
  wireAmount: z.number().min(0).default(0),
  foreignCurrencyAmount: z.number().min(0).default(0),
  foreignCurrencyType: z.string().default("USD"),
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
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    const where: any = { pharmacyId, deletedAt: null };

    if (year && month) {
      const y = Number(year); const mo = Number(month);
      const mm = String(mo).padStart(2, "0");
      const lastDay = new Date(y, mo, 0).getDate();
      const start = new Date(`${y}-${mm}-01T00:00:00.000Z`);
      const end = new Date(`${y}-${mm}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`);
      where.registerDate = { gte: start, lte: end };
    }

    const records = await prisma.dailyRegister.findMany({
      where,
      orderBy: { registerDate: "desc" },
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error("Kasa GET Error:", error);
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
    const validated = kasaSchema.parse(body);

    // Tarihi normalize et: sadece yıl-ay-gün al, saat 00:00:00 UTC
    const dateStr = validated.registerDate.split("T")[0];
    const registerDate = new Date(`${dateStr}T00:00:00.000Z`);

    // Aynı tarihe mükerrer kayıt kontrolü
    const existing = await prisma.dailyRegister.findFirst({
      where: { pharmacyId, registerDate, deletedAt: null },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Bu tarih için zaten bir kasa kapatma kaydı mevcut. Düzenleme yapabilirsiniz." },
        { status: 409 }
      );
    }

    const record = await prisma.dailyRegister.create({
      data: {
        pharmacyId,
        registerDate,
        posAmount: validated.posAmount,
        cashAmount: validated.cashAmount,
        wireAmount: validated.wireAmount,
        foreignCurrencyAmount: validated.foreignCurrencyAmount,
        foreignCurrencyType: validated.foreignCurrencyType,
        notes: validated.notes,
      },
    });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    console.error("Kasa POST Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: (error as any).errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}
