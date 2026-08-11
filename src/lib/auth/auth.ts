import NextAuth, { CredentialsSignin } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validators/auth";
import { authConfig } from "./auth.config";
import { verifyTotpCode } from "./totp";

/**
 * Şifre doğru ama hesapta 2FA açık ve geçerli bir OTP kodu sağlanmadığında
 * fırlatılır. `CredentialsSignin` alt sınıfı olduğu için Auth.js bunu
 * "yanlış şifre" ile aynı genel hataya sarmaz — `code` alanı istemciye
 * (giriş sayfası) redirect URL'sindeki `code` parametresi olarak ulaşır,
 * böylece istemci "yanlış şifre" ile "OTP gerekli" durumlarını ayırt edebilir.
 */
class TwoFactorRequiredError extends CredentialsSignin {
  code = "2FA_REQUIRED";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "Kimlik Bilgileri",
      credentials: {
        email: { label: "E-Posta", type: "email" },
        password: { label: "Şifre", type: "password" },
        otpCode: { label: "Doğrulama Kodu", type: "text" },
      },
      async authorize(credentials) {
        const validated = loginSchema.safeParse(credentials);
        if (!validated.success) return null;

        const { email, password, otpCode } = validated.data;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            pharmacistName: true,
            isActive: true,
            deletedAt: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
          },
        });

        if (!user || user.deletedAt || !user.isActive) return null;
        if (!user.password) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        // İki adımlı doğrulama (2FA) açık kullanıcılar için şifre doğru olsa bile
        // geçerli bir OTP kodu zorunludur. Kod eksik/hatalıysa girişi reddet — istemci
        // bu hatayı "yanlış şifre" hatasından ayırt edip OTP giriş alanını gösterir.
        if (user.twoFactorEnabled) {
          if (!user.twoFactorSecret) return null;
          if (!otpCode || !verifyTotpCode(user.email, user.twoFactorSecret, otpCode)) {
            throw new TwoFactorRequiredError();
          }
        }

        // Son giriş zamanı güncelle
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        // Audit log
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "LOGIN",
            entityType: "User",
            entityId: user.id,
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          pharmacistName: user.pharmacistName,
        };
      },
    }),
  ],
});
