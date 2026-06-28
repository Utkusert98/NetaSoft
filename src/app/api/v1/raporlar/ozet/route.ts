import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiResponse } from "@/lib/utils";

async function getPharmacyId(userId: string): Promise<string | null> {
  const role = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return role?.pharmacyId ?? null;
}

export async function GET(req: NextRequest): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return apiError("Yetkisiz", "UNAUTHORIZED", 401);

  const pharmacyId = await getPharmacyId(session.user.id);
  if (!pharmacyId) return apiError("Eczane bulunamadı", "NO_PHARMACY", 404);

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  const start = startParam ? new Date(startParam) : new Date(new Date().getFullYear(), 0, 1);
  const end = endParam ? new Date(endParam) : new Date();
  end.setHours(23, 59, 59, 999);

  const [dailyRegs, sgkInvoices, platformIncomes, fixedExpenses, employeeExpenses, promissoryNotes] =
    await Promise.all([
      prisma.dailyRegister.findMany({
        where: { pharmacyId, deletedAt: null, registerDate: { gte: start, lte: end } },
        select: { registerDate: true, posAmount: true, cashAmount: true, wireAmount: true },
        orderBy: { registerDate: "asc" },
      }),
      prisma.sgkInvoice.findMany({
        where: { pharmacyId, deletedAt: null, invoiceDate: { gte: start, lte: end } },
        select: { invoiceDate: true, invoiceType: true, amount: true },
        orderBy: { invoiceDate: "asc" },
      }),
      prisma.platformIncome.findMany({
        where: { pharmacyId, deletedAt: null, incomeDate: { gte: start, lte: end } },
        select: { incomeDate: true, platformName: true, amount: true, status: true },
        orderBy: { incomeDate: "asc" },
      }),
      prisma.fixedExpense.findMany({
        where: { pharmacyId, deletedAt: null, expenseDate: { gte: start, lte: end } },
        select: { expenseDate: true, type: true, customType: true, amount: true },
        orderBy: { expenseDate: "asc" },
      }),
      prisma.employeeExpense.findMany({
        where: { pharmacyId, expenseDate: { gte: start, lte: end } },
        select: { expenseDate: true, salaryAmount: true, sgkAmount: true, totalAmount: true },
        orderBy: { expenseDate: "asc" },
      }),
      prisma.promissoryNote.findMany({
        where: { pharmacyId, deletedAt: null, dueDate: { gte: start, lte: end } },
        select: { dueDate: true, amount: true, isPaid: true, noteNumber: true },
        orderBy: { dueDate: "asc" },
      }),
    ]);

  // Aylık gruplama
  const monthlyMap = new Map<string, {
    month: string; gelir: number; gider: number;
    kasa: number; sgk: number; platform: number;
    sabitGider: number; personelGider: number;
  }>();

  const getKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const getLabel = (d: Date) => d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });

  const ensureMonth = (d: Date) => {
    const key = getKey(d);
    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { month: getLabel(d), gelir: 0, gider: 0, kasa: 0, sgk: 0, platform: 0, sabitGider: 0, personelGider: 0 });
    }
    return monthlyMap.get(key)!;
  };

  dailyRegs.forEach(r => {
    const m = ensureMonth(new Date(r.registerDate));
    const v = Number(r.posAmount) + Number(r.cashAmount) + Number(r.wireAmount);
    m.kasa += v; m.gelir += v;
  });
  sgkInvoices.forEach(r => {
    const m = ensureMonth(new Date(r.invoiceDate));
    m.sgk += Number(r.amount); m.gelir += Number(r.amount);
  });
  platformIncomes.forEach(r => {
    const m = ensureMonth(new Date(r.incomeDate));
    m.platform += Number(r.amount); m.gelir += Number(r.amount);
  });
  fixedExpenses.forEach(r => {
    const m = ensureMonth(new Date(r.expenseDate));
    m.sabitGider += Number(r.amount); m.gider += Number(r.amount);
  });
  employeeExpenses.forEach(r => {
    const m = ensureMonth(new Date(r.expenseDate));
    m.personelGider += Number(r.totalAmount); m.gider += Number(r.totalAmount);
  });

  const monthly = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ ...v, kar: v.gelir - v.gider }));

  const totalIncome = monthly.reduce((s, m) => s + m.gelir, 0);
  const totalExpense = monthly.reduce((s, m) => s + m.gider, 0);

  // Gider kategorileri
  const expenseByType: Record<string, number> = {};
  fixedExpenses.forEach(r => {
    const k = r.customType ?? r.type;
    expenseByType[k] = (expenseByType[k] ?? 0) + Number(r.amount);
  });
  const totalEmpExp = employeeExpenses.reduce((s, r) => s + Number(r.totalAmount), 0);
  if (totalEmpExp > 0) expenseByType["PERSONEL"] = totalEmpExp;

  // Gelir kaynakları
  const incomeBySource = {
    kasa: dailyRegs.reduce((s, r) => s + Number(r.posAmount) + Number(r.cashAmount) + Number(r.wireAmount), 0),
    sgk: sgkInvoices.reduce((s, r) => s + Number(r.amount), 0),
    platform: platformIncomes.reduce((s, r) => s + Number(r.amount), 0),
  };

  // Platform bazlı gelir
  const platformByName: Record<string, number> = {};
  platformIncomes.forEach(r => {
    platformByName[r.platformName] = (platformByName[r.platformName] ?? 0) + Number(r.amount);
  });

  return apiResponse({
    period: { start: start.toISOString(), end: end.toISOString() },
    summary: { totalIncome, totalExpense, netProfit: totalIncome - totalExpense },
    monthly,
    incomeBySource,
    expenseByType,
    platformByName,
    promissoryNotes: promissoryNotes.map(n => ({
      dueDate: n.dueDate.toISOString(),
      amount: Number(n.amount),
      isPaid: n.isPaid,
      noteNumber: n.noteNumber,
    })),
  });
}
