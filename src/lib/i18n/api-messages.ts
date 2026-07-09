export type Lang = "tr" | "en";

export function getLang(req: Request): Lang {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("lang");
  if (fromQuery === "en") return "en";
  const acceptLang = req.headers.get("accept-language") ?? "";
  if (acceptLang.startsWith("en")) return "en";
  return "tr";
}

const messages = {
  unauthorized:       { tr: "Yetkisiz erişim",                    en: "Unauthorized" },
  notFound:           { tr: "Kayıt bulunamadı",                   en: "Record not found" },
  noPharmacy:         { tr: "Eczane bulunamadı",                  en: "Pharmacy not found" },
  serverError:        { tr: "Sunucu hatası, lütfen tekrar deneyin", en: "Server error, please try again" },
  validationError:    { tr: "Geçersiz veri",                      en: "Invalid data" },
  emailExists:        { tr: "Bu e-posta adresi zaten kayıtlı",    en: "This email is already registered" },
  wrongPassword:      { tr: "Mevcut şifre hatalı",                en: "Current password is incorrect" },
  noPassword:         { tr: "Şifre değiştirme desteklenmiyor",    en: "Password change not supported" },
  sameAsEmail:        { tr: "Şifre e-posta ile aynı olamaz",      en: "Password cannot be the same as your email" },
  created:            { tr: "Başarıyla oluşturuldu",              en: "Created successfully" },
  updated:            { tr: "Başarıyla güncellendi",              en: "Updated successfully" },
  deleted:            { tr: "Başarıyla silindi",                  en: "Deleted successfully" },
} as const;

export type MessageKey = keyof typeof messages;

export function m(key: MessageKey, lang: Lang): string {
  return messages[key][lang];
}

// Zod validation errors — map Turkish Zod messages to bilingual versions
const zodMessages: Record<string, { tr: string; en: string }> = {
  "Şifre en az 12 karakter olmalıdır": { tr: "Şifre en az 12 karakter olmalıdır", en: "Password must be at least 12 characters" },
  "Şifre en fazla 128 karakter olabilir": { tr: "Şifre en fazla 128 karakter olabilir", en: "Password cannot exceed 128 characters" },
  "Şifre en az 1 büyük harf içermelidir (A-Z)": { tr: "Şifre en az 1 büyük harf içermelidir (A-Z)", en: "Password must contain at least 1 uppercase letter (A-Z)" },
  "Şifre en az 1 küçük harf içermelidir (a-z)": { tr: "Şifre en az 1 küçük harf içermelidir (a-z)", en: "Password must contain at least 1 lowercase letter (a-z)" },
  "Şifre en az 1 rakam içermelidir (0-9)": { tr: "Şifre en az 1 rakam içermelidir (0-9)", en: "Password must contain at least 1 digit (0-9)" },
  "Şifre en az 1 özel karakter içermelidir (!@#$%^&*...)": { tr: "Şifre en az 1 özel karakter içermelidir (!@#$%^&*...)", en: "Password must contain at least 1 special character (!@#$%^&*...)" },
  "Şifre aynı karakteri 3 veya daha fazla kez art arda içeremez": { tr: "Şifre aynı karakteri 3 veya daha fazla kez art arda içeremez", en: "Password cannot have 3 or more consecutive identical characters" },
  "Bu şifre çok yaygın, lütfen farklı bir şifre seçin": { tr: "Bu şifre çok yaygın, lütfen farklı bir şifre seçin", en: "This password is too common, please choose a different one" },
  "Şifreler eşleşmiyor": { tr: "Şifreler eşleşmiyor", en: "Passwords do not match" },
  "Şifre e-posta adresinizi içeremez": { tr: "Şifre e-posta adresinizi içeremez", en: "Password cannot contain your email address" },
  "Eczane Adı en az 2 karakter olmalıdır": { tr: "Eczane Adı en az 2 karakter olmalıdır", en: "Pharmacy name must be at least 2 characters" },
  "Eczane Adı en fazla 100 karakter olabilir": { tr: "Eczane Adı en fazla 100 karakter olabilir", en: "Pharmacy name cannot exceed 100 characters" },
  "Eczacı Adı en az 2 karakter olmalıdır": { tr: "Eczacı Adı en az 2 karakter olmalıdır", en: "Pharmacist name must be at least 2 characters" },
  "Eczacı Adı en fazla 100 karakter olabilir": { tr: "Eczacı Adı en fazla 100 karakter olabilir", en: "Pharmacist name cannot exceed 100 characters" },
  "Geçerli bir e-posta adresi giriniz": { tr: "Geçerli bir e-posta adresi giriniz", en: "Please enter a valid email address" },
  "Şifre gereklidir": { tr: "Şifre gereklidir", en: "Password is required" },
};

export function translateZod(message: string, lang: Lang): string {
  if (lang === "tr") return message;
  return zodMessages[message]?.[lang] ?? message;
}
