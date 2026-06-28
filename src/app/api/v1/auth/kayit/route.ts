import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { registerSchema } from "@/lib/validators/auth";
import { apiError, apiResponse } from "@/lib/utils";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as unknown;

    // Validasyon
    const validated = registerSchema.safeParse(body);
    if (!validated.success) {
      const firstError = validated.error.issues[0];
      return apiError(firstError.message, "VALIDATION_ERROR", 422);
    }

    const { pharmacyName, pharmacistName, email, password } = validated.data;

    // E-posta benzersizlik kontrolü
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return apiError(
        "Bu e-posta adresi zaten kayıtlı",
        "EMAIL_EXISTS",
        409
      );
    }

    // Şifre hash (12 rounds)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Transaction içinde kullanıcı + eczane + rol oluştur
    const result = await prisma.$transaction(async (tx) => {
      // 1. Kullanıcı oluştur
      const user = await tx.user.create({
        data: {
          email,
          name: pharmacistName,
          pharmacistName,
          password: hashedPassword,
        },
        select: { id: true, email: true, name: true },
      });

      // 2. Eczane oluştur
      const pharmacy = await tx.pharmacy.create({
        data: {
          name: pharmacyName,
        },
        select: { id: true, name: true },
      });

      // 3. Kullanıcı-Eczane rolü oluştur (OWNER)
      await tx.userPharmacyRole.create({
        data: {
          userId: user.id,
          pharmacyId: pharmacy.id,
          role: "OWNER",
        },
      });

      // 4. Varsayılan işlem kategorilerini oluştur
      const defaultCategories = [
        { name: "İlaç Satışı", type: "INCOME" as const, color: "#38a169", isSystem: true },
        { name: "Reçete Geliri", type: "INCOME" as const, color: "#3182ce", isSystem: true },
        { name: "SGK Ödemesi", type: "INCOME" as const, color: "#9f7aea", isSystem: true },
        { name: "Diğer Gelir", type: "INCOME" as const, color: "#718096", isSystem: true },
        { name: "İlaç Alımı", type: "EXPENSE" as const, color: "#e53e3e", isSystem: true },
        { name: "Kira", type: "EXPENSE" as const, color: "#dd6b20", isSystem: true },
        { name: "Personel Gideri", type: "EXPENSE" as const, color: "#d69e2e", isSystem: true },
        { name: "Vergi", type: "EXPENSE" as const, color: "#718096", isSystem: true },
        { name: "Diğer Gider", type: "EXPENSE" as const, color: "#a0aec0", isSystem: true },
      ];

      await tx.transactionCategory.createMany({
        data: defaultCategories,
      });

      // 5. Audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          pharmacyId: pharmacy.id,
          action: "REGISTER",
          entityType: "User",
          entityId: user.id,
          newData: { email, pharmacyName },
        },
      });

      return { user, pharmacy };
    });

    return apiResponse(
      {
        message: "Hesabınız başarıyla oluşturuldu",
        userId: result.user.id,
      },
      201
    );
  } catch (error) {
    console.error("[REGISTER ERROR]", error);
    return apiError(
      "Sunucu hatası, lütfen tekrar deneyin",
      "SERVER_ERROR",
      500
    );
  }
}
