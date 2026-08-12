/**
 * Tekil e-posta gönderim noktası. Şu an gerçek bir e-posta servisi
 * BAĞLANMADI — `RESEND_API_KEY` ortam değişkeni ayarlanınca Resend'in HTTP
 * API'si üzerinden gönderim otomatik devreye girer (bkz. resend.com, ek bir
 * paket kurulumu gerekmez). Ayarlanmadığı sürece e-posta gönderilmez;
 * bunun yerine içerik (özellikle şifre sıfırlama linki gibi tek kullanımlık
 * URL'ler) sunucu loglarına yazılır — bu SADECE geçici bir geliştirme
 * önlemidir, üretimde gerçek bir servis bağlanana kadar kullanıcılar gerçek
 * bir e-posta ALMAYACAKTIR.
 */

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "NetaSoft <onboarding@resend.dev>";

  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn(
      `[E-POSTA GÖNDERİLEMEDİ — RESEND_API_KEY ayarlı değil] Alıcı: ${to}, Konu: ${subject}\n${html}`
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[E-POSTA GÖNDERİM HATASI] ${res.status} ${errText}`);
  }
}
