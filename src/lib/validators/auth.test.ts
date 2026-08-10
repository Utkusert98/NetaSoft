import { describe, it, expect } from "vitest";
import { passwordSchema, registerSchema, calculatePasswordStrength } from "./auth";

describe("passwordSchema", () => {
  it("kabul eder: kurallara uyan güçlü şifre", () => {
    expect(passwordSchema.safeParse("Gecerli!Sifre9").success).toBe(true);
  });

  it("reddeder: 12 karakterden kısa şifre", () => {
    expect(passwordSchema.safeParse("Kisa1!ab").success).toBe(false);
  });

  it("reddeder: büyük harf içermeyen şifre", () => {
    expect(passwordSchema.safeParse("gecerli!sifre9").success).toBe(false);
  });

  it("reddeder: küçük harf içermeyen şifre", () => {
    expect(passwordSchema.safeParse("GECERLI!SIFRE9").success).toBe(false);
  });

  it("reddeder: rakam içermeyen şifre", () => {
    expect(passwordSchema.safeParse("Gecerli!Sifree").success).toBe(false);
  });

  it("reddeder: özel karakter içermeyen şifre", () => {
    expect(passwordSchema.safeParse("Gecerli1Sifre9").success).toBe(false);
  });

  it("reddeder: 3+ ardışık tekrar eden karakter", () => {
    expect(passwordSchema.safeParse("Aaa11111!!Sifre").success).toBe(false);
  });

  it("reddeder: yaygın şifreler listesindeki değer", () => {
    expect(passwordSchema.safeParse("netasoft123").success).toBe(false);
  });
});

describe("registerSchema", () => {
  const base = {
    pharmacyName: "Test Eczanesi",
    pharmacistName: "Test Eczacı",
    email: "eczaci@example.com",
    password: "Gecerli!Sifre9",
    confirmPassword: "Gecerli!Sifre9",
  };

  it("kabul eder: geçerli kayıt verisi", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it("reddeder: şifreler eşleşmiyorsa", () => {
    const result = registerSchema.safeParse({ ...base, confirmPassword: "Farkli!Sifre9" });
    expect(result.success).toBe(false);
  });

  it("reddeder: şifre email'in kullanıcı adı kısmını içeriyorsa", () => {
    const result = registerSchema.safeParse({
      ...base,
      password: "Eczaci123!Sifre",
      confirmPassword: "Eczaci123!Sifre",
    });
    expect(result.success).toBe(false);
  });
});

describe("calculatePasswordStrength", () => {
  it("zayıf bir şifreye düşük skor verir", () => {
    const result = calculatePasswordStrength("abc");
    expect(result.score).toBeLessThanOrEqual(2);
  });

  it("güçlü bir şifreye yüksek skor verir", () => {
    const result = calculatePasswordStrength("CokGucluBirSifre!2024#");
    expect(result.score).toBe(5);
  });
});
