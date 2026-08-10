import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

export const ACTIVE_PHARMACY_COOKIE = "active_pharmacy_id";

export async function getActivePharmacyId(userId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const selected = cookieStore.get(ACTIVE_PHARMACY_COOKIE)?.value;

  if (selected) {
    const role = await prisma.userPharmacyRole.findFirst({
      where: { userId, pharmacyId: selected },
      select: { pharmacyId: true },
    });
    if (role) return role.pharmacyId;
  }

  const first = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { pharmacyId: true },
  });
  return first?.pharmacyId ?? null;
}

export async function listUserPharmacies(userId: string): Promise<
  Array<{ role: string; pharmacy: { id: string; name: string; city: string | null } }>
> {
  return prisma.userPharmacyRole.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { role: true, pharmacy: { select: { id: true, name: true, city: true } } },
  });
}
