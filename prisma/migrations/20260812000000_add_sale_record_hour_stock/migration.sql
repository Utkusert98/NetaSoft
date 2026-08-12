-- Satış kayıtlarına opsiyonel, geriye dönük uyumlu (nullable) sütunlar ekle:
-- "Saat" sütunundan çıkarılan saat bileşeni (saatlik yoğunluk grafiği için) ve
-- "Stok Adet" sütunundan gelen, satış anındaki stok anlık görüntüsü (hızlı
-- tükenen ürün sinyali için). IF NOT EXISTS ile idempotent — bu repo daha önce
-- idempotent olmayan migration'lar yüzünden üretim deploy'larının bozulmasından
-- etkilenmişti.
ALTER TABLE "sale_records" ADD COLUMN IF NOT EXISTS "sale_hour" INTEGER;
ALTER TABLE "sale_records" ADD COLUMN IF NOT EXISTS "stock_at_sale" INTEGER;
