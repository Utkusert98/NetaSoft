import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { apiError, apiResponse } from "@/lib/utils";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { ACTIVE_PHARMACY_COOKIE, getActivePharmacyId, listUserPharmacies } from "@/lib/pharmacy";

const switchSchema = z.object({
  pharmacyId: z.string().min(1, "Eczane seçilmelidir"),
});

export async function GET(req: NextRequest): Promise<Response> {
  const lang = getLang(req);
  const session = await auth();
  if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

  const userPharmacies = await listUserPharmacies(session.user.id);
  const pharmacies = userPharmacies.map((up) => ({
    id: up.pharmacy.id,
    name: up.pharmacy.name,
    city: up.pharmacy.city,
    role: up.role,
  }));
  const activePharmacyId = await getActivePharmacyId(session.user.id);

  return apiResponse({ pharmacies, activePharmacyId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const lang = getLang(req);
  const session = await auth();
  if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

  const body = await req.json() as unknown;
  const parsed = switchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(translateZod(parsed.error.issues[0]?.message ?? "", lang), "VALIDATION_ERROR", 400);
  }

  const { pharmacyId } = parsed.data;
  const role = await prisma.userPharmacyRole.findFirst({
    where: { userId: session.user.id, pharmacyId },
    select: { pharmacyId: true },
  });
  if (!role) return apiError(m("forbidden", lang), "FORBIDDEN", 403);

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PHARMACY_COOKIE, pharmacyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return apiResponse({ pharmacyId });
}
