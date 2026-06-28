/**
 * Capital Case utility - tüm kelimelerin ilk harfini büyük yapar
 */
export function toCapitalCase(str: string): string {
  if (!str) return "";
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Para birimi formatı (Türk Lirası)
 */
export function formatCurrency(
  amount: number | string,
  currency = "TRY"
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Tarih formatı (Türkçe)
 */
export function formatDate(date: Date | string, short = false): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (short) {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  }
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Dosya boyutu formatı
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Kullanıcı adı baş harflerini al (Avatar için)
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * API yanıt standardı
 */
export function apiResponse<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function apiError(error: string, code: string, status = 400) {
  return Response.json({ success: false, error, code }, { status });
}

/**
 * Sayfa başlığı formatı
 */
export function formatPageTitle(title: string): string {
  return toCapitalCase(title);
}
