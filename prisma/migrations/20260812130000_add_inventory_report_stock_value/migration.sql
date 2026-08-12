-- Envanter raporuna "gerçek stok değeri" alanı ekle (dönem içi satış verisi
-- olmasa bile her zaman anlamlı). Daha önce sadece dönem içi SATILAN ürünlerin
-- cirosu (total_revenue) saklanıyordu; Gösterge Paneli "Toplam Stok Değeri"
-- etiketiyle bunu gösterdiği için satışsız dosyalarda hep ₺0 çıkıyordu.
-- IF NOT EXISTS ile idempotent.
ALTER TABLE "inventory_reports" ADD COLUMN IF NOT EXISTS "total_stock_value" DECIMAL(15,2) NOT NULL DEFAULT 0;
