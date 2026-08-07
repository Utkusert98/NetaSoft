import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { addMonths } from "date-fns";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";

const senetSchema = z.object({
  noteNumber: z.string().min(1, "Senet no gereklidir"),
  supplierName: z.string().optional(),
  issueDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  amount: z.number().min(0.01, "Tutar 0'dan büyük olmalıdır"),
  notes: z.string().optional(),
  isInstallment: z.boolean().default(false),
  installmentCount: z.number().min(2).optional(),
});

export async function POST(req: Request) {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: m("unauthorized", lang), code: "UNAUTHORIZED" }, { status: 401 });
    }

    // Get user's pharmacy
    const userRole = await prisma.userPharmacyRole.findFirst({
      where: { userId: session.user.id },
      select: { pharmacyId: true },
    });

    if (!userRole) {
      return NextResponse.json({ success: false, error: m("noPharmacy", lang), code: "NO_PHARMACY" }, { status: 404 });
    }

    const body = await req.json();
    const validated = senetSchema.parse(body);

    const baseDueDate = new Date(validated.dueDate);
    const issueDate = new Date(validated.issueDate);

    if (validated.isInstallment && validated.installmentCount && validated.installmentCount >= 2) {
      const count = validated.installmentCount;
      const amountPerInstallment = validated.amount / count;
      const groupId = `grp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const notesToCreate = Array.from({ length: count }).map((_, i) => ({
        pharmacyId: userRole.pharmacyId,
        noteNumber: `${validated.noteNumber}-${i + 1}/${count}`,
        supplierName: validated.supplierName,
        issueDate,
        dueDate: addMonths(baseDueDate, i),
        amount: amountPerInstallment,
        notes: validated.notes ? `${validated.notes} (${i + 1}. Taksit)` : `${i + 1}. Taksit`,
        installmentGroupId: groupId,
        installmentNumber: i + 1,
      }));

      await prisma.promissoryNote.createMany({
        data: notesToCreate,
      });

      return NextResponse.json({ success: true, count }, { status: 201 });
    } else {
      // Single note
      const note = await prisma.promissoryNote.create({
        data: {
          pharmacyId: userRole.pharmacyId,
          noteNumber: validated.noteNumber,
          supplierName: validated.supplierName,
          issueDate,
          dueDate: baseDueDate,
          amount: validated.amount,
          notes: validated.notes,
        },
      });

      return NextResponse.json({ success: true, data: note }, { status: 201 });
    }
  } catch (error) {
    console.error("Senet Create Error:", error);
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
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: m("unauthorized", lang), code: "UNAUTHORIZED" }, { status: 401 });
    }

    const userRole = await prisma.userPharmacyRole.findFirst({
      where: { userId: session.user.id },
      select: { pharmacyId: true },
    });

    if (!userRole) return NextResponse.json({ success: false, error: m("noPharmacy", lang), code: "NO_PHARMACY" }, { status: 404 });

    const notes = await prisma.promissoryNote.findMany({
      where: { pharmacyId: userRole.pharmacyId, deletedAt: null },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json({ success: true, data: notes });
  } catch (error) {
    return NextResponse.json({ success: false, error: m("serverError", lang), code: "SERVER_ERROR" }, { status: 500 });
  }
}
