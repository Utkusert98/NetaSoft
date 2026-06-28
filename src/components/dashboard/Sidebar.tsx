"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { NetaSoftIcon, NetaSoftLogoFull } from "@/components/ui/NetaSoftLogo";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Genel",
    items: [
      { href: "/panel", label: "Gösterge Paneli", icon: "📊" },
      { href: "/ai-destek", label: "AI Asistan", icon: "🤖" },
    ],
  },
  {
    title: "Finans",
    items: [
      { href: "/finans/kasa", label: "Günlük Kasa", icon: "🏦" },
      { href: "/finans/senet", label: "Senet Girişi", icon: "📄" },
      { href: "/finans/sabit-gider", label: "Sabit Giderler", icon: "💸" },
      { href: "/finans/calisan", label: "Personel Giderleri", icon: "👥" },
      { href: "/finans/sgk-fatura", label: "SGK Fatura", icon: "🏥" },
      { href: "/finans/platform-gelir", label: "Platform Gelirleri", icon: "📈" },
    ],
  },
  {
    title: "Stok Yönetimi",
    items: [
      { href: "/stok/envanter", label: "Envanter Raporu", icon: "📊" },
    ],
  },
  {
    title: "Raporlar",
    items: [
      { href: "/raporlar/gelir-gider", label: "Gelir - Gider", icon: "📉" },
      { href: "/raporlar/aylik", label: "Aylık Özet", icon: "📅" },
    ],
  },
  {
    title: "Sistem",
    items: [
      { href: "/ayarlar", label: "Ayarlar", icon: "⚙️" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const isActive = (href: string) => {
    if (href === "/panel") return pathname === "/panel";
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await signOut({ redirect: true, redirectUrl: "/giris" });
  };

  return (
    <>
      {/* Mobile topbar — logo sol, hamburger sağ */}
      <header className="mobile-topbar">
        <NetaSoftLogoFull size={28} variant="white" />
        <button
          className="sidebar-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Menüyü Kapat" : "Menüyü Aç"}
          aria-expanded={open}
        >
          {open ? "✕" : "☰"}
        </button>
      </header>

      {/* Overlay */}
      <div
        className={`sidebar-overlay ${open ? "open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`sidebar ${open ? "open" : ""}`} role="navigation" aria-label="Ana Menü">
        {/* Logo */}
        <div className="sidebar-logo">
          <NetaSoftIcon size={32} />
          <span className="sidebar-logo-text">
            Neta<span>Soft</span>
          </span>
        </div>

        {/* Navigasyon */}
        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="sidebar-section">
              <div className="sidebar-section-title">{section.title}</div>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  id={`nav-${item.href.replace(/\//g, "-").slice(1)}`}
                  className={`sidebar-item ${isActive(item.href) ? "active" : ""}`}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  <span className="sidebar-item-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}

          {/* Çıkış Yap */}
          <div className="sidebar-section" style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "12px" }}>
            <button
              onClick={() => void handleLogout()}
              className="sidebar-item"
              style={{
                background: "var(--color-danger)",
                border: "none",
                cursor: "pointer",
                color: "white",
                width: "100%",
                textAlign: "left",
                padding: "12px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.85";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              <span style={{ fontSize: "18px" }}>🚪</span>
              Çıkış Yap
            </button>
          </div>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px",
            borderRadius: "var(--radius-md)",
            background: "rgba(255,255,255,0.05)",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(159,232,112,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px", fontWeight: 700, color: "var(--sidebar-accent)", flexShrink: 0,
            }}>
              NS
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "white", fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                NetaSoft
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px" }}>
                Eczane Yönetim
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
