-- Satış kayıtlarına opsiyonel, geriye dönük uyumlu (nullable) sütunlar ekle:
-- ham işlem tipi (ödeme yöntemi ayrımı için), müşteri/cari adı ve sadakat puanı.
ALTER TABLE "sale_records" ADD COLUMN "raw_transaction_type" TEXT;
ALTER TABLE "sale_records" ADD COLUMN "customer_name" TEXT;
ALTER TABLE "sale_records" ADD COLUMN "loyalty_points" DECIMAL(15,2);
