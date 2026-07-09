import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import { DashboardProviders } from "@/app/providers/DashboardProviders";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s — NetaSoft",
    default: "NetaSoft | Eczane Yönetim Sistemi",
  },
  description: "Eczaneler için finansal yönetim sistemi",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/giris");

  return (
    <DashboardProviders>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content" id="main-content">
          {children}
        </main>
      </div>
    </DashboardProviders>
  );
}
