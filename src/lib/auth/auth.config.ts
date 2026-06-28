import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Bu dosya SADECE middleware'de kullanılır
// Prisma veya diğer Node.js native modülleri import ETMEYİN
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/giris",
    error: "/giris",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      const isAuthPage =
        pathname.startsWith("/giris") || pathname.startsWith("/kayit");

      const isProtectedRoute =
        pathname.startsWith("/panel") ||
        pathname.startsWith("/finans") ||
        pathname.startsWith("/stok") ||
        pathname.startsWith("/fatura") ||
        pathname.startsWith("/raporlar") ||
        pathname.startsWith("/ayarlar");

      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL("/panel", nextUrl));
      }

      if (!isLoggedIn && isProtectedRoute) {
        const loginUrl = new URL("/giris", nextUrl);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return Response.redirect(loginUrl);
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.pharmacistName = (user as { pharmacistName?: string }).pharmacistName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as { pharmacistName?: string }).pharmacistName =
          token.pharmacistName as string | undefined;
      }
      return session;
    },
  },
  providers: [
    // Middleware için provider sadece type tanımı gerekiyor
    // Gerçek authorize mantığı auth.ts'de
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async () => null, // Middleware'de kullanılmıyor
    }),
  ],
  session: { strategy: "jwt" },
};
