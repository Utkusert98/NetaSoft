"use client";

import { useEffect } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      // localStorage'dan theme'i oku, varsayılan "light"
      const savedTheme = localStorage.getItem("netasoft-theme") || "light";
      document.documentElement.setAttribute("data-theme", savedTheme);
      document.documentElement.style.colorScheme = savedTheme === "dark" ? "dark" : "light";
    } catch {
      // localStorage erişimi başarısız olursa, light mode devam et
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  return <>{children}</>;
}
