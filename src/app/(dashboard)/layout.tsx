import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | NetaSoft",
    default: "Gösterge Paneli | NetaSoft",
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/giris");

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" id="main-content">
        {children}
      </main>
    </div>
  );
}
