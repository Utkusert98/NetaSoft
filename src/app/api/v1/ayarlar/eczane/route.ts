import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiResponse } from "@/lib/utils";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";
import { z } from "zod";

async function getPharmacyId(userId: string): Promise<string | null> {
  const role = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return role?.pharmacyId ?? null;
}

const schema = z.object({
  name: z.string().min(2, "Eczane adı en az 2 karakter olmalıdır"),
  taxNumber: z.string().optional().nullable(),
  licenseNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Geçerli e-posta giriniz").optional().nullable().or(z.literal("")),
  city: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
});

export async function GET(req: NextRequest): Promise<Response> {
  const lang = getLang(req);
  const session = await auth();
  if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

  const pharmacyId = await getPharmacyId(session.user.id);
  if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { id: pharmacyId },
    select: { id: true, name: true, taxNumber: true, licenseNumber: true, address: true, phone: true, email: true, city: true, district: true },
  });

  return apiResponse(pharmacy);
}

export async function PUT(req: NextRequest): Promise<Response> {
  const lang = getLang(req);
  const session = await auth();
  if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

  const pharmacyId = await getPharmacyId(session.user.id);
  if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

  const body = await req.json() as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(translateZod(parsed.error.issues[0]?.message ?? "", lang), "VALIDATION_ERROR", 400);
  }

  const data = { ...parsed.data, email: parsed.data.email || null };
  const pharmacy = await prisma.pharmacy.update({ where: { id: pharmacyId }, data });
  return apiResponse(pharmacy);
}
