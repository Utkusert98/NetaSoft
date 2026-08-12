import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // `viewport-fit=cover` olmadan `env(safe-area-inset-*)` her zaman 0 döner;
  // sabit (fixed) konumlu elemanların iOS çentik/home-indicator alanının
  // altında kalmaması için gereklidir (bkz. .mobile-topbar / .toast-container
  // / .drp-popover mobil stilleri).
  viewportFit: "cover",
  themeColor: "#163300",
};

export const metadata: Metadata = {
  title: {
    template: "%s | NetaSoft",
    default: "NetaSoft — Eczane Finansal Yönetim Sistemi",
  },
  description:
    "NetaSoft, eczaneler için geliştirilmiş kapsamlı finansal yönetim platformudur. Gelir-gider takibi, fatura yönetimi ve stok kontrolü tek çatı altında.",
  keywords: ["eczane", "finansal yönetim", "muhasebe", "stok", "fatura"],
  authors: [{ name: "NetaSoft" }],
  robots: "noindex, nofollow", // Üretim için değiştirilecek
  manifest: "/manifest.json",
  // iOS Safari "Ana Ekrana Ekle" ile tam ekran, tarayıcı çubuğu olmadan
  // uygulama gibi açılması için — App Store gerektirmeyen ücretsiz bir
  // "app" deneyimi (gerçek native uygulama değil, PWA).
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NetaSoft",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
