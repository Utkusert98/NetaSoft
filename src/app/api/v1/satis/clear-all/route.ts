import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiResponse } from "@/lib/utils";

async function getPharmacyId(userId: string): Promise<string | null> {
  const role = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return role?.pharmacyId ?? null;
}

export async function DELETE(): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError("Yetkisiz", "UNAUTHORIZED", 401);
    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return apiError("Eczane bulunamadı", "NO_PHARMACY", 404);

    const { count } = await prisma.saleRecord.updateMany({
      where: { pharmacyId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return apiResponse({ deleted: count });
  } catch {
    return apiError("Sunucu hatası", "SERVER_ERROR", 500);
  }
}
