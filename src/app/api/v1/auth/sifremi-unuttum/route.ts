import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { forgotPasswordSchema } from "@/lib/validators/auth";
import { apiError, apiResponse } from "@/lib/utils";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";
import { rateLimit } from "@/lib/utils/rate-limit";
import { sendEmail } from "@/lib/email/sendEmail";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 saat
const RESET_REQUEST_LIMIT = 5;
const RESET_REQUEST_WINDOW_MS = 15 * 60 * 1000;

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function POST(request: Request): Promise<Response> {
  const lang = getLang(request);

  try {
    const body = await request.json() as unknown;
    const validated = forgotPasswordSchema.safeParse(body);
    if (!validated.success) {
      const firstError = validated.error.issues[0];
      return apiError(translateZod(firstError.message, lang), "VALIDATION_ERROR", 422);
    }
    const { email } = validated.data;

    // IP + e-posta bazlı hız sınırlama — kullanıcı sıralı e-posta deneyerek
    // hesap keşfi (enumeration) yapamasın veya spam gönderemesin.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rl = rateLimit(`forgot-password:${ip}:${email}`, RESET_REQUEST_LIMIT, RESET_REQUEST_WINDOW_MS);
    if (!rl.allowed) {
      return apiError(m("rateLimited", lang), "RATE_LIMITED", 429);
    }

    // Kullanıcı var mı yok mu FARK ETMEKSİZİN her zaman aynı genel mesajla
    // dönülür (hesap keşfini/e-posta enumeration'ını önlemek için) — sadece
    // gerçekten kayıtlıysa arka planda token üretilir ve e-posta gönderilir.
    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
      select: { id: true, name: true },
    });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      const resetUrl = `${appUrl}/sifre-sifirla?token=${rawToken}`;

      await sendEmail({
        to: email,
        subject: lang === "en" ? "Reset your NetaSoft password" : "NetaSoft şifrenizi sıfırlayın",
        html: lang === "en"
          ? `<p>Hello${user.name ? " " + user.name : ""},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can ignore this email.</p>`
          : `<p>Merhaba${user.name ? " " + user.name : ""},</p><p>Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın. Bu bağlantı 1 saat içinde geçersiz olacaktır.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>`,
      });
    }

    return apiResponse({ message: m("resetLinkSent", lang) });
  } catch (error) {
    console.error("[FORGOT PASSWORD ERROR]", error instanceof Error ? error.message : error);
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
