import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validators/auth";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "Kimlik Bilgileri",
      credentials: {
        email: { label: "E-Posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        const validated = loginSchema.safeParse(credentials);
        if (!validated.success) return null;

        const { email, password } = validated.data;

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
          },
        });

        if (!user || user.deletedAt || !user.isActive) return null;
        if (!user.password) return null;

        const isValid = await bcrypt.compare(password, user.password);
        // TODO: twoFactorEnabled kullanıcılar için authorize() sonrası ikinci adım (OTP doğrulama)
        // akışı ayrı bir UI değişikliği gerektirir — şu an sadece ayarlar sayfasından 2FA
        // açılıp/kapatılabiliyor, login akışına entegre değil.
        if (!isValid) return null;

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
