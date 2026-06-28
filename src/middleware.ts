import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";

// Middleware sadece authConfig kullanır - Edge Runtime uyumlu, Prisma yok
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
