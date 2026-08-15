-- "Düzenli Ödeme" özelliği: kira, kredi kartı borcu gibi sözleşme boyunca
-- sabit tutarlı giderleri tek bir işlemle birden fazla aya/yıla/güne
-- yayarak oluşturmak için, üretilen satırları gruplamaya yarayan alan.
ALTER TABLE "fixed_expenses" ADD COLUMN "recurring_id" TEXT;

CREATE INDEX "fixed_expenses_pharmacy_id_recurring_id_idx" ON "fixed_expenses"("pharmacy_id", "recurring_id");
