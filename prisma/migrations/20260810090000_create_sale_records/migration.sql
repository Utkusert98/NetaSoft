-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SaleType" AS ENUM ('PRESCRIPTION', 'RETAIL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "sale_records" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "product_group" TEXT,
    "product_name" TEXT NOT NULL,
    "sale_date" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "net_revenue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sale_type" "SaleType" NOT NULL DEFAULT 'RETAIL',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "import_batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sale_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sale_records_pharmacy_id_sale_date_idx" ON "sale_records"("pharmacy_id", "sale_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sale_records_pharmacy_id_sale_type_idx" ON "sale_records"("pharmacy_id", "sale_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sale_records_pharmacy_id_product_group_idx" ON "sale_records"("pharmacy_id", "product_group");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sale_records_deleted_at_idx" ON "sale_records"("deleted_at");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "sale_records" ADD CONSTRAINT "sale_records_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
