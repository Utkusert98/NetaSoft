"use client";

import { useEffect, useState } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      // localStorage'dan theme'i oku, varsayılan "light"
      const savedTheme = localStorage.getItem("netasoft-theme") || "light";
      document.documentElement.setAttribute("data-theme", savedTheme);
      document.documentElement.style.colorScheme = savedTheme === "dark" ? "dark" : "light";
    } catch (e) {
      // localStorage erişimi başarısız olursa, light mode devam et
      document.documentElement.setAttribute("data-theme", "light");
    }
    setMounted(true);
  }, []);

  // Hydration sorunlarını önlemek için mounted olmadan render etme
  if (!mounted) return <>{children}</>;

  return <>{children}</>;
}
