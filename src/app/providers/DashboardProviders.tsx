"use client";

import { LangProvider } from "./LangProvider";
import type { ReactNode } from "react";

export function DashboardProviders({ children }: { children: ReactNode }) {
  return <LangProvider>{children}</LangProvider>;
}
