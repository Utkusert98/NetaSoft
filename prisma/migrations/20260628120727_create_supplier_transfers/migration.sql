-- CreateTable
CREATE TABLE IF NOT EXISTS "supplier_transfers" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "transfer_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "supplier_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "supplier_transfers_pharmacy_id_transfer_date_idx" ON "supplier_transfers"("pharmacy_id", "transfer_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "supplier_transfers_deleted_at_idx" ON "supplier_transfers"("deleted_at");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "supplier_transfers" ADD CONSTRAINT "supplier_transfers_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
