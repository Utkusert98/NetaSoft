// One-time script: recompute expectedPaymentDate for all SGK invoices.
// Rule: 15th of the month that is 3 calendar months after invoiceDate.
// Run: node --env-file=.env scripts/fix-sgk-dates.mjs

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function correctDate(invoiceDate) {
  const d = new Date(invoiceDate);
  const rawMonth = d.getUTCMonth() + 3;
  return new Date(Date.UTC(
    d.getUTCFullYear() + Math.floor(rawMonth / 12),
    rawMonth % 12,
    15,
  ));
}

async function main() {
  const invoices = await prisma.sgkInvoice.findMany({
    where: { deletedAt: null },
    select: { id: true, invoiceDate: true, expectedPaymentDate: true },
  });

  let fixed = 0;
  let skipped = 0;

  for (const inv of invoices) {
    const correct = correctDate(inv.invoiceDate);
    const current = new Date(inv.expectedPaymentDate);

    if (current.toISOString() === correct.toISOString()) {
      skipped++;
      continue;
    }

    await prisma.sgkInvoice.update({
      where: { id: inv.id },
      data: { expectedPaymentDate: correct },
    });
    console.log(
      `  ✓ ${inv.id.slice(0, 8)} | fatura: ${inv.invoiceDate.toISOString().slice(0,10)} | ${current.toISOString().slice(0,10)} → ${correct.toISOString().slice(0,10)}`
    );
    fixed++;
  }

  console.log(`\nToplam: ${invoices.length} kayıt | Düzeltildi: ${fixed} | Değişmedi: ${skipped}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
