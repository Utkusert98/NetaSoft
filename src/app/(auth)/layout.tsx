import type { Metadata } from "next";
import { LangProvider } from "@/app/providers/LangProvider";

export const metadata: Metadata = {
  title: "Giriş Yap | NetaSoft",
  description: "NetaSoft hesabınıza giriş yapın",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LangProvider>{children}</LangProvider>;
}
