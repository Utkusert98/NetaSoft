import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

// One-time migration: fix SGK invoices where expectedPaymentDate.day !== 15.
// Formula: 15th of the month that is 3 calendar months after invoiceDate.
export async function POST(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const invoices = await prisma.sgkInvoice.findMany({
    where: { deletedAt: null },
    select: { id: true, invoiceDate: true, expectedPaymentDate: true },
  });

  const toFix = invoices.filter(inv => {
    const d = new Date(inv.expectedPaymentDate);
    return d.getUTCDate() !== 15;
  });

  let fixed = 0;
  for (const inv of toFix) {
    const d = new Date(inv.invoiceDate);
    const payYear = d.getUTCFullYear();
    const payMonth = d.getUTCMonth() + 3; // add 3 months (0-indexed + 3)
    const correctedDate = new Date(Date.UTC(
      payYear + Math.floor(payMonth / 12),
      payMonth % 12,
      15,
    ));
    await prisma.sgkInvoice.update({
      where: { id: inv.id },
      data: { expectedPaymentDate: correctedDate },
    });
    fixed++;
  }

  return NextResponse.json({
    success: true,
    total: invoices.length,
    fixed,
    skipped: invoices.length - fixed,
  });
}
