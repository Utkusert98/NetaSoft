-- Envanter analizi anlık görüntülerini saklamak için yeni tablo
CREATE TABLE "inventory_reports" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "total_products" INTEGER NOT NULL,
    "sold_products" INTEGER NOT NULL,
    "total_revenue" DECIMAL(15,2) NOT NULL,
    "total_cost" DECIMAL(15,2) NOT NULL,
    "total_profit" DECIMAL(15,2) NOT NULL,
    "profit_margin" DECIMAL(6,2) NOT NULL,
    "items" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "inventory_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_reports_pharmacy_id_deleted_at_idx" ON "inventory_reports"("pharmacy_id", "deleted_at");
CREATE INDEX "inventory_reports_pharmacy_id_created_at_idx" ON "inventory_reports"("pharmacy_id", "created_at");

ALTER TABLE "inventory_reports" ADD CONSTRAINT "inventory_reports_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_reports" ADD CONSTRAINT "inventory_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
