"use client";

import { useEffect } from "react";
import Link from "next/link";
import { NetaSoftIcon } from "@/components/ui/NetaSoftLogo";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Hata izleme servisine gönderme henüz yok — en azından konsola düşer,
    // kullanıcıya markalı bir ekran gösterilir (çıplak Next.js hata sayfası yerine).
    console.error(error);
  }, [error]);

  return (
    <main style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center",
      padding: "var(--spacing-6)", gap: "var(--spacing-4)", background: "var(--color-bg)",
    }}>
      <NetaSoftIcon size={56} />
      <p style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, color: "var(--color-text)" }}>
        Bir Şeyler Ters Gitti
      </p>
      <p style={{ color: "var(--color-text-muted)", maxWidth: 420, fontSize: "var(--font-size-sm)" }}>
        Beklenmeyen bir hata oluştu. Tekrar deneyebilir veya ana sayfaya dönebilirsiniz.
      </p>
      <div style={{ display: "flex", gap: "var(--spacing-3)", marginTop: "var(--spacing-2)" }}>
        <button onClick={() => reset()} className="btn btn-primary">
          Tekrar Dene
        </button>
        <Link href="/panel" className="btn">
          Ana Sayfaya Dön
        </Link>
      </div>
    </main>
  );
}
