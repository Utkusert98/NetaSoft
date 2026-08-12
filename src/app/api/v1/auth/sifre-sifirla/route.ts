import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { resetPasswordSchema } from "@/lib/validators/auth";
import { apiError, apiResponse } from "@/lib/utils";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";
import { logAudit } from "@/lib/audit";

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function POST(request: Request): Promise<Response> {
  const lang = getLang(request);

  try {
    const body = await request.json() as unknown;
    const validated = resetPasswordSchema.safeParse(body);
    if (!validated.success) {
      const firstError = validated.error.issues[0];
      return apiError(translateZod(firstError.message, lang), "VALIDATION_ERROR", 422);
    }
    const { token, password } = validated.data;
    const tokenHash = hashToken(token);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return apiError(m("resetTokenInvalid", lang), "TOKEN_INVALID", 400);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Aynı kullanıcının kullanılmamış diğer tüm token'ları da geçersiz
      // kılınır — bir token kullanıldıktan sonra eski e-postalardaki
      // linklerle tekrar şifre değiştirilemesin.
      prisma.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null, id: { not: resetToken.id } },
        data: { usedAt: new Date() },
      }),
    ]);

    await logAudit({
      userId: resetToken.userId,
      action: "UPDATE",
      entityType: "User",
      entityId: resetToken.userId,
      newData: { note: "Şifremi Unuttum akışıyla şifre sıfırlandı" },
    });

    return apiResponse({ message: m("resetSuccess", lang) });
  } catch (error) {
    console.error("[RESET PASSWORD ERROR]", error instanceof Error ? error.message : error);
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
