import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { addMonths } from "date-fns";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m } from "@/lib/i18n/api-messages";

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

export async function POST(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);
    }

    // Get user's pharmacy
    const userRole = await prisma.userPharmacyRole.findFirst({
      where: { userId: session.user.id },
      select: { pharmacyId: true },
    });

    if (!userRole) {
      return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);
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

      await logAudit({
        userId: session.user.id,
        pharmacyId: userRole.pharmacyId,
        action: "CREATE",
        entityType: "PromissoryNote",
        entityId: groupId,
        newData: { installmentGroupId: groupId, count, notes: notesToCreate },
      });

      return apiResponse({ count }, 201);
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

      await logAudit({
        userId: session.user.id,
        pharmacyId: userRole.pharmacyId,
        action: "CREATE",
        entityType: "PromissoryNote",
        entityId: note.id,
        newData: note,
      });

      return apiResponse(note, 201);
    }
  } catch (error) {
    console.error("Senet Create Error:", error instanceof Error ? error.message : error);
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
    if (!session?.user?.id) {
      return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);
    }

    const userRole = await prisma.userPharmacyRole.findFirst({
      where: { userId: session.user.id },
      select: { pharmacyId: true },
    });

    if (!userRole) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const notes = await prisma.promissoryNote.findMany({
      where: { pharmacyId: userRole.pharmacyId, deletedAt: null },
      orderBy: { dueDate: "asc" },
    });

    return apiResponse(notes);
  } catch {
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
