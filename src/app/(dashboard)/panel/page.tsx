import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { DashboardData } from "./DashboardClient";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Gösterge Paneli",
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
  const y = now.getUTCFullYear(); const m = now.getUTCMonth() + 1;
  const mm = String(m).padStart(2, "0");
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const startOfMonth = new Date(`${y}-${mm}-01T00:00:00.000Z`);
  const endOfMonth = new Date(`${y}-${mm}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`);

  // Previous month for change %
  const pm = m === 1 ? 12 : m - 1; const py = m === 1 ? y - 1 : y;
  const pmm = String(pm).padStart(2, "0");
  const lastDayPrev = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const startOfPrevMonth = new Date(`${py}-${pmm}-01T00:00:00.000Z`);
  const endOfPrevMonth = new Date(`${py}-${pmm}-${String(lastDayPrev).padStart(2, "0")}T23:59:59.999Z`);

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
    currentNotes,
    prevNotes,
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
      where: { pharmacyId, deletedAt: null, expectedPaymentDate: { gte: startOfMonth, lte: endOfMonth } },
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
    // Promissory notes due current month (ödendi ya da vadeli — senet = gider taahhüdü)
    prisma.promissoryNote.findMany({
      where: { pharmacyId, deletedAt: null, dueDate: { gte: startOfMonth, lte: endOfMonth } },
      select: { amount: true },
    }),
    // Promissory notes due prev month
    prisma.promissoryNote.findMany({
      where: { pharmacyId, deletedAt: null, dueDate: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
      select: { amount: true },
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

  const cashIncome = (arr: { posAmount: unknown; cashAmount: unknown; wireAmount: unknown }[]): number =>
    arr.reduce((s: number, r: { posAmount: unknown; cashAmount: unknown; wireAmount: unknown }) =>
      s + Number(r.posAmount) + Number(r.cashAmount) + Number(r.wireAmount), 0)

  const currentCash = cashIncome(currentDailyRegs);
  const prevCash = cashIncome(prevDailyRegs);
  const currentSgkTotal = sumDecimal(currentSgk, "amount");
  const currentPlatformTotal = sumDecimal(currentPlatform, "amount");

  const totalIncome = currentCash + currentSgkTotal + currentPlatformTotal;
  const prevIncome = prevCash;

  const totalExpense =
    sumDecimal(currentFixedExp, "amount") +
    sumDecimal(currentEmpExp, "totalAmount") +
    sumDecimal(currentNotes, "amount");
  const prevExpense =
    sumDecimal(prevFixedExp, "amount") +
    sumDecimal(prevEmpExp, "totalAmount") +
    sumDecimal(prevNotes, "amount");

  const pct = (cur: number, prev: number) =>
    prev === 0 ? 0 : ((cur - prev) / prev) * 100;

  // SGK vs cash ratio
  const sgkVsCash = {
    sgkTotal: currentSgkTotal,
    cashTotal: currentCash,
    sgkCount: currentSgk.length,
    cashDays: currentDailyRegs.length,
  };

  // ── New computed fields ───────────────────────────────────────────────────
  const daysElapsed = Math.max(1, now.getDate());
  const dailyAvgCiro = currentCash / daysElapsed;

  const posTotal = currentDailyRegs.reduce((s: number, r: { posAmount: unknown }) => s + Number(r.posAmount), 0);
  const actualCashTotal = currentDailyRegs.reduce((s: number, r: { cashAmount: unknown }) => s + Number(r.cashAmount), 0);

  const fixedExpenseTotal = sumDecimal(currentFixedExp, "amount");
  const empExpenseTotal = sumDecimal(currentEmpExp, "totalAmount");
  const notesExpenseTotal = sumDecimal(currentNotes, "amount");

  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const urgentNotesCount = promissoryNotes.filter(
    (n: typeof promissoryNotes[number]) => !n.isPaid && n.dueDate <= sevenDaysFromNow
  ).length;

  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcoming30Notes = promissoryNotes
    .filter((n: typeof promissoryNotes[number]) => !n.isPaid && n.dueDate >= now && n.dueDate <= thirtyDaysFromNow)
    .reduce((s: number, n: typeof promissoryNotes[number]) => s + Number(n.amount), 0);

  const runway30 = {
    projectedIncome: dailyAvgCiro * 30,
    committedExpense: upcoming30Notes + (totalExpense / daysElapsed) * 30,
  };

  return {
    summary: {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      incomeChange: pct(totalIncome, prevIncome),
      expenseChange: pct(totalExpense, prevExpense),
    },
    promissoryNotes: promissoryNotes.map((n: typeof promissoryNotes[number]) => ({
      id: n.id,
      noteNumber: n.noteNumber,
      dueDate: n.dueDate.toISOString(),
      amount: Number(n.amount),
      isPaid: n.isPaid,
    })),
    sgkVsCash,
    monthlyTrend,
    upcomingSgk: upcomingSgk.map((s: typeof upcomingSgk[number]) => ({
      id: s.id,
      invoiceType: s.invoiceType,
      amount: Number(s.amount),
      expectedPaymentDate: s.expectedPaymentDate.toISOString(),
    })),
    platformIncome: platformIncomeList.map((p: typeof platformIncomeList[number]) => ({
      platformName: p.platformName,
      amount: Number(p._sum.amount ?? 0),
      status: p.status,
    })),
    dailyAvgCiro,
    cashPosSplit: { posTotal, cashTotal: actualCashTotal },
    expenseBreakdown: [
      { name: "Sabit Gider", nameEn: "Fixed", value: fixedExpenseTotal },
      { name: "Personel", nameEn: "Staff", value: empExpenseTotal },
      { name: "Senet", nameEn: "Notes", value: notesExpenseTotal },
    ].filter(e => e.value > 0),
    urgentNotesCount,
    runway30,
  };
}

async function buildMonthlyTrend(pharmacyId: string): Promise<DashboardData["monthlyTrend"]> {
  const MONTHS = 6;
  const now = new Date();
  const result: DashboardData["monthlyTrend"] = [];

  for (let i = MONTHS - 1; i >= 0; i--) {
    const baseYear = now.getUTCFullYear(); const baseMonth = now.getUTCMonth() + 1;
    const totalMonths = baseMonth - i;
    const tYear = baseYear + Math.floor((totalMonths - 1) / 12);
    const tMonth = ((totalMonths - 1 + 12 * 12) % 12) + 1;
    const tmm = String(tMonth).padStart(2, "0");
    const tLastDay = new Date(Date.UTC(tYear, tMonth, 0)).getUTCDate();
    const start = new Date(`${tYear}-${tmm}-01T00:00:00.000Z`);
    const end = new Date(`${tYear}-${tmm}-${String(tLastDay).padStart(2, "0")}T23:59:59.999Z`);
    const label = new Date(tYear, tMonth - 1, 1).toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });

    const [daily, sgk, platform, fixed, emp, notes] = await Promise.all([
      prisma.dailyRegister.findMany({ where: { pharmacyId, deletedAt: null, registerDate: { gte: start, lte: end } }, select: { posAmount: true, cashAmount: true, wireAmount: true } }),
      prisma.sgkInvoice.aggregate({ where: { pharmacyId, deletedAt: null, expectedPaymentDate: { gte: start, lte: end } }, _sum: { amount: true } }),
      prisma.platformIncome.aggregate({ where: { pharmacyId, deletedAt: null, incomeDate: { gte: start, lte: end } }, _sum: { amount: true } }),
      prisma.fixedExpense.aggregate({ where: { pharmacyId, deletedAt: null, expenseDate: { gte: start, lte: end } }, _sum: { amount: true } }),
      prisma.employeeExpense.aggregate({ where: { pharmacyId, expenseDate: { gte: start, lte: end } }, _sum: { totalAmount: true } }),
      prisma.promissoryNote.aggregate({ where: { pharmacyId, deletedAt: null, dueDate: { gte: start, lte: end } }, _sum: { amount: true } }),
    ]);

    const cash = daily.reduce((s: number, r: { posAmount: unknown; cashAmount: unknown; wireAmount: unknown }) =>
      s + Number(r.posAmount) + Number(r.cashAmount) + Number(r.wireAmount), 0);
    const gelir = cash + Number(sgk._sum.amount ?? 0) + Number(platform._sum.amount ?? 0);
    const gider = Number(fixed._sum.amount ?? 0) + Number(emp._sum.totalAmount ?? 0) + Number(notes._sum.amount ?? 0);

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
