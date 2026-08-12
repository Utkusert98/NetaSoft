-- Satış Raporu yüklemelerine dosya adı eklenir — kullanıcı "bu dosyayı
-- yükledim mi" diye düşünmesin diye İçe Aktarma Geçmişi/Denetim Kayıtları'nda
-- gösterilecek.
ALTER TABLE "sale_records" ADD COLUMN IF NOT EXISTS "file_name" TEXT;

-- Envanter raporuna stok bazlı kâr marjı eklenir (satış verisi olmasa bile
-- her zaman anlamlı) — total_stock_value ile aynı kök sebep, bkz. o migration.
ALTER TABLE "inventory_reports" ADD COLUMN IF NOT EXISTS "potential_margin" DECIMAL(6,2) NOT NULL DEFAULT 0;
