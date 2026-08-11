import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiResponse } from "@/lib/utils";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { createTotp, verifyTotpCode } from "@/lib/auth/totp";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setup") }),
  z.object({ action: z.literal("confirm"), code: z.string().min(6, "Doğrulama kodu gereklidir").max(6) }),
  z.object({ action: z.literal("disable"), currentPassword: z.string().min(1, "Şifre gereklidir") }),
]);

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return apiError("Yetkisiz", "UNAUTHORIZED", 401);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  });
  return apiResponse({ twoFactorEnabled: user?.twoFactorEnabled ?? false });
}

export async function POST(req: NextRequest): Promise<Response> {
  const lang = getLang(req);
  const session = await auth();
  if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);

  const body = await req.json() as unknown;
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(translateZod(parsed.error.issues[0]?.message ?? "", lang), "VALIDATION_ERROR", 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, password: true, twoFactorSecret: true },
  });
  if (!user) return apiError(m("notFound", lang), "NOT_FOUND", 404);

  if (parsed.data.action === "setup") {
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = createTotp(user.email, secret.base32);
    const uri = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(uri);

    await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret.base32 } });

    return apiResponse({ qrCodeDataUrl, secret: secret.base32 });
  }

  if (parsed.data.action === "confirm") {
    if (!user.twoFactorSecret) {
      return apiError("Önce 2FA kurulumunu başlatmalısınız", "SETUP_REQUIRED", 400);
    }
    if (!verifyTotpCode(user.email, user.twoFactorSecret, parsed.data.code)) {
      return apiError("Doğrulama kodu hatalı", "INVALID_CODE", 400);
    }

    // Yedek kurtarma kodları — tek kullanımlık, şifre gibi hassas gizli anahtarlar değildir.
    const backupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString("hex"));

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true, twoFactorBackupCodes: backupCodes },
    });

    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entityType: "User",
      entityId: user.id,
      newData: { twoFactorEnabled: true },
    });

    return apiResponse({ backupCodes });
  }

  // action === "disable"
  if (!user.password) return apiError(m("noPassword", lang), "NO_PASSWORD", 400);
  const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!valid) return apiError(m("wrongPassword", lang), "WRONG_PASSWORD", 400);

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
  });

  await logAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    newData: { twoFactorEnabled: false },
  });

  return apiResponse({ message: lang === "en" ? "Two-factor authentication disabled" : "İki adımlı doğrulama devre dışı bırakıldı" });
}
