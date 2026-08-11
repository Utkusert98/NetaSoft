import * as OTPAuth from "otpauth";

/**
 * NetaSoft genelinde 2FA (TOTP) kurulum ve doğrulama akışlarında kullanılan
 * ortak yapılandırma. Ayarlar sayfasındaki kurulum akışı ile giriş akışındaki
 * doğrulama aynı parametreleri kullanmalıdır, aksi halde kullanıcının
 * authenticator uygulamasında ürettiği kod sunucuda geçersiz sayılır.
 */
const TOTP_ISSUER = "NetaSoft";
const TOTP_ALGORITHM = "SHA1";
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30;
/** Zaman kayması toleransı — bir önceki/sonraki 30sn periyodunu da kabul eder. */
const TOTP_WINDOW = 1;

/**
 * Verilen base32 gizli anahtar için TOTP nesnesi oluşturur.
 */
export function createTotp(email: string, base32Secret: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: email,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  });
}

/**
 * Kullanıcının girdiği 6 haneli kodu, kayıtlı base32 gizli anahtara göre doğrular.
 * Kod geçerliyse true, değilse (veya girişler bozuksa) false döner.
 * Hem 2FA kurulum onayı hem de giriş akışındaki OTP doğrulaması bu fonksiyonu kullanır.
 */
export function verifyTotpCode(email: string, base32Secret: string, code: string): boolean {
  if (!base32Secret || !code) return false;
  if (!/^\d{6}$/.test(code.trim())) return false;

  try {
    const totp = createTotp(email, base32Secret);
    const delta = totp.validate({ token: code.trim(), window: TOTP_WINDOW });
    return delta !== null;
  } catch {
    return false;
  }
}
