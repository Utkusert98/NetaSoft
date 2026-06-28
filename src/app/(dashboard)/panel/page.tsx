import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { DashboardData } from "./DashboardClient";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Gösterge Paneli | NetaSoft",
};

async function getPharmacyId(userId: string): Promise<string | null> {
  const role = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return role?.pharmacyId ?? null;
}

async function getDashboardData(pharmacyId: string): Promise<DashboardData> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Previous month for change %
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // ── Parallel queries ──────────────────────────────────────────────────
  const [
    currentDailyRegs,
    prevDailyRegs,
    currentSgk,
    currentPlatform,
    currentFixedExp,
    currentEmpExp,
    prevFixedExp,
    prevEmpExp,
    promissoryNotes,
    upcomingSgk,
    monthlyTrend,
    platformIncomeList,
  ] = await Promise.all([
    // Daily register current month
    prisma.dailyRegister.findMany({
      where: { pharmacyId, deletedAt: null, registerDate: { gte: startOfMonth, lte: endOfMonth } },
      select: { posAmount: true, cashAmount: true, wireAmount: true },
    }),
    // Daily register prev month
    prisma.dailyRegister.findMany({
      where: { pharmacyId, deletedAt: null, registerDate: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
      select: { posAmount: true, cashAmount: true, wireAmount: true },
    }),
    // SGK invoices current month
    prisma.sgkInvoice.findMany({
      where: { pharmacyId, deletedAt: null, invoiceDate: { gte: startOfMonth, lte: endOfMonth } },
      select: { amount: true },
    }),
    // Platform income current month
    prisma.platformIncome.findMany({
      where: { pharmacyId, deletedAt: null, incomeDate: { gte: startOfMonth, lte: endOfMonth } },
      select: { amount: true },
    }),
    // Fixed expenses current month
    prisma.fixedExpense.findMany({
      where: { pharmacyId, deletedAt: null, expenseDate: { gte: startOfMonth, lte: endOfMonth } },
      select: { amount: true },
    }),
    // Employee expenses current month
    prisma.employeeExpense.findMany({
      where: { pharmacyId, expenseDate: { gte: startOfMonth, lte: endOfMonth } },
      select: { totalAmount: true },
    }),
    // Fixed expenses prev month
    prisma.fixedExpense.findMany({
      where: { pharmacyId, deletedAt: null, expenseDate: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
      select: { amount: true },
    }),
    // Employee expenses prev month
    prisma.employeeExpense.findMany({
      where: { pharmacyId, expenseDate: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
      select: { totalAmount: true },
    }),
    // Promissory notes upcoming 60 days
    prisma.promissoryNote.findMany({
      where: {
        pharmacyId, deletedAt: null,
        dueDate: { gte: new Date(now.getFullYear(), now.getMonth() - 1, 1) },
      },
      select: { id: true, noteNumber: true, dueDate: true, amount: true, isPaid: true },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    // Upcoming SGK +3 months
    prisma.sgkInvoice.findMany({
      where: {
        pharmacyId, deletedAt: null,
        expectedPaymentDate: {
          gte: now,
          lte: new Date(now.getFullYear(), now.getMonth() + 3, 0),
        },
      },
      select: { id: true, invoiceType: true, amount: true, expectedPaymentDate: true },
      orderBy: { expectedPaymentDate: "asc" },
      take: 6,
    }),
    // Monthly trend: last 6 months
    buildMonthlyTrend(pharmacyId),
    // Platform income this month grouped by platform
    prisma.platformIncome.groupBy({
      by: ["platformName", "status"],
      where: { pharmacyId, deletedAt: null, incomeDate: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    }),
  ]);

  // ── Compute totals ────────────────────────────────────────────────────
  const sumDecimal = (arr: { amount?: unknown; posAmount?: unknown; cashAmount?: unknown; wireAmount?: unknown; totalAmount?: unknown }[], key: string) =>
    arr.reduce((s, r) => s + Number((r as Record<string, unknown>)[key] ?? 0), 0);

  const cashIncome = (arr: typeof currentDailyRegs) =>
    arr.reduce((s, r) => s + Number(r.posAmount) + Number(r.cashAmount) + Number(r.wireAmount), 0);

  const currentCash = cashIncome(currentDailyRegs);
  const prevCash = cashIncome(prevDailyRegs);
  const currentSgkTotal = sumDecimal(currentSgk, "amount");
  const currentPlatformTotal = sumDecimal(currentPlatform, "amount");

  const totalIncome = currentCash + currentSgkTotal + currentPlatformTotal;
  const prevIncome = prevCash;

  const totalExpense =
    sumDecimal(currentFixedExp, "amount") +
    sumDecimal(currentEmpExp, "totalAmount");
  const prevExpense =
    sumDecimal(prevFixedExp, "amount") +
    sumDecimal(prevEmpExp, "totalAmount");

  const pct = (cur: number, prev: number) =>
    prev === 0 ? 0 : ((cur - prev) / prev) * 100;

  // SGK vs cash ratio
  const sgkVsCash = {
    sgkTotal: currentSgkTotal,
    cashTotal: currentCash,
    sgkCount: currentSgk.length,
    cashDays: currentDailyRegs.length,
  };

  return {
    summary: {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      incomeChange: pct(totalIncome, prevIncome),
      expenseChange: pct(totalExpense, prevExpense),
    },
    promissoryNotes: promissoryNotes.map((n) => ({
      id: n.id,
      noteNumber: n.noteNumber,
      dueDate: n.dueDate.toISOString(),
      amount: Number(n.amount),
      isPaid: n.isPaid,
    })),
    sgkVsCash,
    monthlyTrend,
    upcomingSgk: upcomingSgk.map((s) => ({
      id: s.id,
      invoiceType: s.invoiceType,
      amount: Number(s.amount),
      expectedPaymentDate: s.expectedPaymentDate.toISOString(),
    })),
    platformIncome: platformIncomeList.map((p) => ({
      platformName: p.platformName,
      amount: Number(p._sum.amount ?? 0),
      status: p.status,
    })),
  };
}

async function buildMonthlyTrend(pharmacyId: string): Promise<DashboardData["monthlyTrend"]> {
  const MONTHS = 6;
  const now = new Date();
  const result: DashboardData["monthlyTrend"] = [];

  for (let i = MONTHS - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const label = start.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });

    const [daily, sgk, platform, fixed, emp] = await Promise.all([
      prisma.dailyRegister.findMany({ where: { pharmacyId, deletedAt: null, registerDate: { gte: start, lte: end } }, select: { posAmount: true, cashAmount: true, wireAmount: true } }),
      prisma.sgkInvoice.aggregate({ where: { pharmacyId, deletedAt: null, invoiceDate: { gte: start, lte: end } }, _sum: { amount: true } }),
      prisma.platformIncome.aggregate({ where: { pharmacyId, deletedAt: null, incomeDate: { gte: start, lte: end } }, _sum: { amount: true } }),
      prisma.fixedExpense.aggregate({ where: { pharmacyId, deletedAt: null, expenseDate: { gte: start, lte: end } }, _sum: { amount: true } }),
      prisma.employeeExpense.aggregate({ where: { pharmacyId, expenseDate: { gte: start, lte: end } }, _sum: { totalAmount: true } }),
    ]);

    const cash = daily.reduce((s, r) => s + Number(r.posAmount) + Number(r.cashAmount) + Number(r.wireAmount), 0);
    const gelir = cash + Number(sgk._sum.amount ?? 0) + Number(platform._sum.amount ?? 0);
    const gider = Number(fixed._sum.amount ?? 0) + Number(emp._sum.totalAmount ?? 0);

    result.push({ month: label, gelir, gider, kar: gelir - gider });
  }
  return result;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris");

  const pharmacyId = await getPharmacyId(session.user.id);
  if (!pharmacyId) redirect("/giris");

  const [data, pharmacy] = await Promise.all([
    getDashboardData(pharmacyId),
    prisma.pharmacy.findUnique({ where: { id: pharmacyId }, select: { name: true } }),
  ]);

  const pharmacistName = pharmacy?.name ?? session.user.name ?? "Eczacı";

  return (
    <main className="page-content">
      <DashboardClient data={data} pharmacistName={pharmacistName} />
    </main>
  );
}
