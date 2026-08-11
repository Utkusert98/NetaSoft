-- Fixes schema drift: PromissoryNote.supplierName and PromissoryNote.paidDate
-- exist in prisma/schema.prisma but were never added by a migration,
-- causing every POST/GET /api/v1/finans/senet to fail with a 500 error.
ALTER TABLE "public"."promissory_notes" ADD COLUMN IF NOT EXISTS "supplier_name" TEXT;
ALTER TABLE "public"."promissory_notes" ADD COLUMN IF NOT EXISTS "paid_date" TIMESTAMP(3);
