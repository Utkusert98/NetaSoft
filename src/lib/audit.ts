import { prisma } from "@/lib/db/prisma";

interface LogAuditParams {
  userId: string;
  pharmacyId?: string | null;
  action: "CREATE" | "UPDATE" | "DELETE";
  entityType: string;
  entityId: string;
  oldData?: unknown;
  newData?: unknown;
}

/** Kritik finansal değişiklikleri audit_logs tablosuna yazar. Hata durumunda işlemi bloklamaz. */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        pharmacyId: params.pharmacyId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldData: params.oldData === undefined ? undefined : (params.oldData as object),
        newData: params.newData === undefined ? undefined : (params.newData as object),
      },
    });
  } catch (error) {
    console.error("Audit log yazılamadı:", error instanceof Error ? error.message : error);
  }
}
