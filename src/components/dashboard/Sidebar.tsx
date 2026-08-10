"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { NetaSoftIcon, NetaSoftLogoFull } from "@/components/ui/NetaSoftLogo";
import { useLangContext } from "@/app/providers/LangProvider";
import { t, tx } from "@/lib/i18n/translations";

interface PharmacyOption {
  id: string;
  name: string;
  city: string | null;
  role: string;
}

interface NavItem {
  href: string;
  labelKey: keyof typeof t.sidebar;
  icon: string;
}

interface NavSection {
  titleKey: keyof typeof t.sidebar;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: "general",
    items: [
      { href: "/panel", labelKey: "dashboard", icon: "📊" },
      { href: "/ai-destek", labelKey: "aiAssistant", icon: "🤖" },
    ],
  },
  {
    titleKey: "finance",
    items: [
      { href: "/finans/kasa", labelKey: "dailyCash", icon: "🏦" },
      { href: "/finans/sgk-fatura", labelKey: "sgkInvoice", icon: "🏥" },
      { href: "/finans/platform-gelir", labelKey: "platformIncome", icon: "📈" },
      { href: "/finans/senet", labelKey: "promissoryNote", icon: "📄" },
      { href: "/finans/sabit-gider", labelKey: "fixedExpense", icon: "💸" },
      { href: "/finans/calisan", labelKey: "staffExpense", icon: "👥" },
    ],
  },
  {
    titleKey: "reports",
    items: [
      { href: "/raporlar/gelir-gider", labelKey: "incomeExpense", icon: "📉" },
      { href: "/raporlar/aylik", labelKey: "monthlySummary", icon: "📅" },
      { href: "/satis/rapor", labelKey: "salesReport", icon: "🧾" },
      { href: "/stok/envanter", labelKey: "inventory", icon: "📦" },
      { href: "/raporlar/denetim", labelKey: "auditLog", icon: "🕵️" },
    ],
  },
  {
    titleKey: "system",
    items: [
      { href: "/ayarlar", labelKey: "settings", icon: "⚙️" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const { lang } = useLangContext();
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);
  const [activePharmacyId, setActivePharmacyId] = useState<string>("");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/ayarlar/eczaneler");
        const json = await res.json() as {
          success: boolean;
          data?: { pharmacies: PharmacyOption[]; activePharmacyId: string | null };
        };
        if (!cancelled && json.success && json.data) {
          setPharmacies(json.data.pharmacies);
          setActivePharmacyId(json.data.activePharmacyId ?? "");
        }
      } catch {
        // Sessizce yoksay — eczane listesi alınamazsa değiştirici görüntülenmez
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePharmacyChange = async (pharmacyId: string): Promise<void> => {
    setSwitching(true);
    try {
      const res = await fetch("/api/v1/ayarlar/eczaneler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pharmacyId }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        setSwitching(false);
      }
    } catch {
      setSwitching(false);
    }
  };

  // Close sidebar on route change (mobile) — render sırasında state senkronizasyonu
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

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
    await signOut({ redirectTo: "/giris" });
  };

  return (
    <>
      {/* Mobile topbar — logo sol, hamburger sağ */}
      <header className="mobile-topbar">
        <NetaSoftLogoFull size={28} variant="white" />
        <button
          className="sidebar-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? (lang === "en" ? "Close Menu" : "Menüyü Kapat") : (lang === "en" ? "Open Menu" : "Menüyü Aç")}
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
      <aside className={`sidebar ${open ? "open" : ""}`} role="navigation" aria-label={lang === "en" ? "Main Menu" : "Ana Menü"}>
        {/* Logo */}
        <div className="sidebar-logo">
          <NetaSoftIcon size={32} />
          <span className="sidebar-logo-text">
            Neta<span>Soft</span>
          </span>
        </div>

        {/* Eczane Değiştirici */}
        {pharmacies.length > 1 && (
          <div style={{ padding: "0 16px 12px" }}>
            <label
              htmlFor="pharmacy-switcher"
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.5)",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
            >
              {tx(t.sidebar.activePharmacy, lang)}
            </label>
            <select
              id="pharmacy-switcher"
              value={activePharmacyId}
              disabled={switching}
              onChange={(e) => void handlePharmacyChange(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                fontSize: "13px",
                fontWeight: 600,
                cursor: switching ? "not-allowed" : "pointer",
                opacity: switching ? 0.6 : 1,
              }}
            >
              {pharmacies.map((p) => (
                <option key={p.id} value={p.id} style={{ color: "#111" }}>
                  {p.name}
                  {p.city ? ` (${p.city})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigasyon */}
        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.titleKey} className="sidebar-section">
              <div className="sidebar-section-title">{tx(t.sidebar[section.titleKey], lang)}</div>
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
                  {tx(t.sidebar[item.labelKey], lang)}
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
              {tx(t.sidebar.logout, lang)}
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
                {tx(t.sidebar.pharmacyMgmt, lang)}
              </div>
            </div>
            <Link
              href="/ayarlar"
              title={lang === "en" ? "Language settings" : "Dil ayarları"}
              style={{
                color: "rgba(255,255,255,0.5)", fontSize: "11px", fontWeight: 700,
                textDecoration: "none", flexShrink: 0,
                padding: "2px 6px", borderRadius: "4px",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {lang.toUpperCase()}
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
