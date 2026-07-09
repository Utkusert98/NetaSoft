import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiResponse } from "@/lib/utils";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";
import { z } from "zod";
import bcrypt from "bcryptjs";

const profileSchema = z.object({
  name: z.string().min(2, "Ad en az 2 karakter olmalıdır"),
  pharmacistName: z.string().optional().nullable(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Mevcut şifre gerekli"),
  newPassword: z.string()
    .min(12, "Şifre en az 12 karakter olmalıdır")
    .regex(/[A-Z]/, "En az 1 büyük harf")
    .regex(/[a-z]/, "En az 1 küçük harf")
    .regex(/[0-9]/, "En az 1 rakam")
    .regex(/[^A-Za-z0-9]/, "En az 1 özel karakter"),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Şifreler eşleşmiyor",
  path: ["confirmPassword"],
});

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return apiError("Yetkisiz", "UNAUTHORIZED", 401);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, pharmacistName: true, createdAt: true },
  });
  return apiResponse(user);
}

export async function PUT(req: NextRequest): Promise<Response> {
  const lang = getLang(req);
  const session = await auth();
  if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

  const body = await req.json() as { action?: string } & Record<string, unknown>;

  if (body.action === "change-password") {
    const parsed = passwordSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(translateZod(parsed.error.issues[0]?.message ?? "", lang), "VALIDATION_ERROR", 400);
    }
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { password: true, email: true } });
    if (!user?.password) return apiError(m("noPassword", lang), "NO_PASSWORD", 400);

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!valid) return apiError(m("wrongPassword", lang), "WRONG_PASSWORD", 400);

    if (parsed.data.newPassword === user.email) return apiError(m("sameAsEmail", lang), "SAME_AS_EMAIL", 400);

    const hashed = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({ where: { id: session.user.id }, data: { password: hashed } });
    return apiResponse({ message: lang === "en" ? "Password updated successfully" : "Şifre başarıyla güncellendi" });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(translateZod(parsed.error.issues[0]?.message ?? "", lang), "VALIDATION_ERROR", 400);
  }
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name, pharmacistName: parsed.data.pharmacistName },
    select: { id: true, name: true, email: true, pharmacistName: true },
  });
  return apiResponse(user);
}
