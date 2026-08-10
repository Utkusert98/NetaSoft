import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiResponse } from "@/lib/utils";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";
import { logAudit } from "@/lib/audit";
import { getActivePharmacyId } from "@/lib/pharmacy";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
  role: z.enum(["ADMIN", "ACCOUNTANT", "VIEWER"], { message: "Geçersiz rol" }),
});

const updateRoleSchema = z.object({
  userId: z.string().min(1, "Kullanıcı seçilmelidir"),
  role: z.enum(["ADMIN", "ACCOUNTANT", "VIEWER"], { message: "Geçersiz rol" }),
});

const removeSchema = z.object({
  userId: z.string().min(1, "Kullanıcı seçilmelidir"),
});

interface TeamMember {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
}

async function requireManagerRole(userId: string, pharmacyId: string): Promise<string | null> {
  const role = await prisma.userPharmacyRole.findFirst({
    where: { userId, pharmacyId },
    select: { role: true },
  });
  return role?.role ?? null;
}

export async function GET(req: NextRequest): Promise<Response> {
  const lang = getLang(req);
  const session = await auth();
  if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

  const pharmacyId = await getActivePharmacyId(session.user.id);
  if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

  const roles = await prisma.userPharmacyRole.findMany({
    where: { pharmacyId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
  });

  const members: TeamMember[] = roles.map((r) => ({
    userId: r.user.id,
    name: r.user.name,
    email: r.user.email,
    role: r.role,
    isActive: r.user.isActive,
  }));

  return apiResponse(members);
}

export async function POST(req: NextRequest): Promise<Response> {
  const lang = getLang(req);
  const session = await auth();
  if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

  const pharmacyId = await getActivePharmacyId(session.user.id);
  if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

  const callerRole = await requireManagerRole(session.user.id, pharmacyId);
  if (callerRole !== "OWNER" && callerRole !== "ADMIN") {
    return apiError("Bu işlem için yetkiniz yok", "FORBIDDEN", 403);
  }

  const body = await req.json() as unknown;
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(translateZod(parsed.error.issues[0]?.message ?? "", lang), "VALIDATION_ERROR", 400);
  }

  const targetUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!targetUser) {
    return apiError("Bu e-posta ile kayıtlı bir kullanıcı bulunamadı. Kullanıcı önce NetaSoft'a kayıt olmalıdır.", "USER_NOT_FOUND", 404);
  }

  try {
    const created = await prisma.userPharmacyRole.create({
      data: { userId: targetUser.id, pharmacyId, role: parsed.data.role },
    });
    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "CREATE",
      entityType: "UserPharmacyRole",
      entityId: created.id,
      newData: { userId: targetUser.id, role: parsed.data.role },
    });
    return apiResponse({ userId: targetUser.id, name: targetUser.name, email: targetUser.email, role: parsed.data.role, isActive: targetUser.isActive });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return apiError("Bu kullanıcı zaten ekipte", "ALREADY_MEMBER", 409);
    }
    throw error;
  }
}

export async function PUT(req: NextRequest): Promise<Response> {
  const lang = getLang(req);
  const session = await auth();
  if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

  const pharmacyId = await getActivePharmacyId(session.user.id);
  if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

  const callerRole = await requireManagerRole(session.user.id, pharmacyId);
  if (callerRole !== "OWNER" && callerRole !== "ADMIN") {
    return apiError("Bu işlem için yetkiniz yok", "FORBIDDEN", 403);
  }

  const body = await req.json() as unknown;
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(translateZod(parsed.error.issues[0]?.message ?? "", lang), "VALIDATION_ERROR", 400);
  }

  const target = await prisma.userPharmacyRole.findFirst({ where: { userId: parsed.data.userId, pharmacyId } });
  if (!target) return apiError(m("notFound", lang), "NOT_FOUND", 404);
  if (target.role === "OWNER") return apiError("Sahip (Owner) rolü değiştirilemez", "CANNOT_CHANGE_OWNER", 400);

  const updated = await prisma.userPharmacyRole.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  });

  await logAudit({
    userId: session.user.id,
    pharmacyId,
    action: "UPDATE",
    entityType: "UserPharmacyRole",
    entityId: updated.id,
    oldData: { role: target.role },
    newData: { role: updated.role },
  });

  return apiResponse({ userId: updated.userId, role: updated.role });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const lang = getLang(req);
  const session = await auth();
  if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

  const pharmacyId = await getActivePharmacyId(session.user.id);
  if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

  const callerRole = await requireManagerRole(session.user.id, pharmacyId);
  if (callerRole !== "OWNER" && callerRole !== "ADMIN") {
    return apiError("Bu işlem için yetkiniz yok", "FORBIDDEN", 403);
  }

  let userId: string | null = null;
  const url = new URL(req.url);
  userId = url.searchParams.get("userId");
  if (!userId) {
    const body = await req.json().catch(() => null) as { userId?: string } | null;
    userId = body?.userId ?? null;
  }
  const parsed = removeSchema.safeParse({ userId });
  if (!parsed.success) {
    return apiError(translateZod(parsed.error.issues[0]?.message ?? "", lang), "VALIDATION_ERROR", 400);
  }

  const target = await prisma.userPharmacyRole.findFirst({ where: { userId: parsed.data.userId, pharmacyId } });
  if (!target) return apiError(m("notFound", lang), "NOT_FOUND", 404);
  // Not: OWNER rolü zaten yukarıda engellendiği için, tek OWNER olan kullanıcının
  // kendini çıkarması da bu kontrolle dolaylı olarak engellenmiş olur.
  if (target.role === "OWNER") return apiError("Sahip (Owner) ekipten çıkarılamaz", "CANNOT_REMOVE_OWNER", 400);

  await prisma.userPharmacyRole.delete({ where: { id: target.id } });

  await logAudit({
    userId: session.user.id,
    pharmacyId,
    action: "DELETE",
    entityType: "UserPharmacyRole",
    entityId: target.id,
    oldData: { userId: target.userId, role: target.role },
  });

  return apiResponse({ message: m("deleted", lang) });
}
