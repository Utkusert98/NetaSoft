import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "xlsx" (SheetJS) yasal .xls (BIFF) dosyaları için lazy/dinamik require
  // kullanan bir kod sayfası (cpexcel) tablosu içerir; Webpack bunu statik
  // analiz edemediği için serverless bundle'a dahil edildiğinde üretimde
  // (Vercel) "Sunucu hatası" ile çöküyordu (yerelde çalışıyor görünüyordu
  // çünkü dev modu aynı şekilde bundle etmiyor) — paket burada dıştalanarak
  // Node çalışma zamanında doğrudan node_modules'tan require edilmesi
  // sağlanır, bu da bu sınıfın tüm bundling kaynaklı hatalarını önler.
  serverExternalPackages: ["pdf-parse", "xlsx"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
      bodySizeLimit: "100mb",
    },
  },
  images: {
    domains: [],
  },
  // Güvenlik başlıkları
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
