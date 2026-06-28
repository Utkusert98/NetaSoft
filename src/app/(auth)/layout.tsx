import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Giriş Yap | NetaSoft",
  description: "NetaSoft hesabınıza giriş yapın",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
