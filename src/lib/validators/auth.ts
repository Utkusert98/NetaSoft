import { z } from "zod";

// Yaygın şifreler kara listesi
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123",
  "123456789012", "qwertyuiop", "qwerty123456",
  "netasoft123", "netasoft1234", "admin123456",
  "12345678901", "1234567890123", "abcdefghijkl",
  "aaaabbbbcccc", "111111111111", "000000000000",
]);

// Ardışık tekrar karakter kontrolü
function hasConsecutiveRepeats(str: string, maxRepeat = 3): boolean {
  for (let i = 0; i <= str.length - maxRepeat; i++) {
    const char = str[i];
    let count = 1;
    while (i + count < str.length && str[i + count] === char) {
      count++;
    }
    if (count >= maxRepeat) return true;
  }
  return false;
}

// Şifre gücü hesaplama (0-5)
export function calculatePasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
  
  // Cap at 5
  score = Math.min(score, 5);
  
  const labels = ["Çok Zayıf", "Zayıf", "Orta", "İyi", "Güçlü", "Çok Güçlü"];
  const colors = ["#e53e3e", "#dd6b20", "#d69e2e", "#38a169", "#25855a", "#1a6644"];
  
  return {
    score,
    label: labels[score],
    color: colors[score],
  };
}

// Şifre validasyon şeması
export const passwordSchema = z
  .string()
  .min(12, "Şifre en az 12 karakter olmalıdır")
  .max(128, "Şifre en fazla 128 karakter olabilir")
  .refine((val) => /[A-Z]/.test(val), {
    message: "Şifre en az 1 büyük harf içermelidir (A-Z)",
  })
  .refine((val) => /[a-z]/.test(val), {
    message: "Şifre en az 1 küçük harf içermelidir (a-z)",
  })
  .refine((val) => /[0-9]/.test(val), {
    message: "Şifre en az 1 rakam içermelidir (0-9)",
  })
  .refine(
    (val) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val),
    { message: "Şifre en az 1 özel karakter içermelidir (!@#$%^&*...)" }
  )
  .refine((val) => !hasConsecutiveRepeats(val, 3), {
    message: "Şifre aynı karakteri 3 veya daha fazla kez art arda içeremez",
  })
  .refine((val) => !COMMON_PASSWORDS.has(val.toLowerCase()), {
    message: "Bu şifre çok yaygın, lütfen farklı bir şifre seçin",
  });

// Kayıt şeması
export const registerSchema = z
  .object({
    pharmacyName: z
      .string()
      .min(2, "Eczane Adı en az 2 karakter olmalıdır")
      .max(100, "Eczane Adı en fazla 100 karakter olabilir")
      .trim(),
    pharmacistName: z
      .string()
      .min(2, "Eczacı Adı en az 2 karakter olmalıdır")
      .max(100, "Eczacı Adı en fazla 100 karakter olabilir")
      .trim(),
    email: z
      .string()
      .email("Geçerli bir e-posta adresi giriniz")
      .toLowerCase()
      .trim(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  })
  .refine(
    (data) =>
      !data.password.toLowerCase().includes(data.email.split("@")[0].toLowerCase()),
    {
      message: "Şifre e-posta adresinizi içeremez",
      path: ["password"],
    }
  );

// Giriş şeması
export const loginSchema = z.object({
  email: z
    .string()
    .email("Geçerli bir e-posta adresi giriniz")
    .toLowerCase()
    .trim(),
  password: z.string().min(1, "Şifre gereklidir"),
  // İki adımlı doğrulama (2FA) açık kullanıcılar için opsiyonel doğrulama kodu.
  // Şifre doğru olduğunda ve twoFactorEnabled ise zorunlu hale gelir (bkz. auth.ts).
  otpCode: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
