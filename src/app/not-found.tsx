import Link from "next/link";
import { NetaSoftIcon } from "@/components/ui/NetaSoftLogo";

export default function NotFound() {
  return (
    <main style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center",
      padding: "var(--spacing-6)", gap: "var(--spacing-4)", background: "var(--color-bg)",
    }}>
      <NetaSoftIcon size={56} />
      <h1 style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, color: "var(--color-text)" }}>404</h1>
      <p style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, color: "var(--color-text)" }}>
        Sayfa Bulunamadı
      </p>
      <p style={{ color: "var(--color-text-muted)", maxWidth: 420, fontSize: "var(--font-size-sm)" }}>
        Aradığınız sayfa taşınmış, silinmiş olabilir veya hiç var olmamış olabilir.
      </p>
      <Link href="/panel" className="btn btn-primary" style={{ marginTop: "var(--spacing-2)" }}>
        Ana Sayfaya Dön
      </Link>
    </main>
  );
}
