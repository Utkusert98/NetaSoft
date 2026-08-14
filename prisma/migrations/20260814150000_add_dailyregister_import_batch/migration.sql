-- Kasa (daily_registers) toplu Excel/CSV yüklemelerini gruplamak için —
-- Satış Raporu'ndaki (sale_records.import_batch_id/file_name) aynı desen.
-- Kullanıcı yanlış eşleştirilmiş/istenmeyen bir dosyayı tek tek gün gün
-- silmek yerine tek bir işlemle TÜM yüklemeyi geri alabilsin diye eklendi
-- (gerçek bir kullanıcı talebiyle).
ALTER TABLE "daily_registers" ADD COLUMN IF NOT EXISTS "import_batch_id" TEXT;
ALTER TABLE "daily_registers" ADD COLUMN IF NOT EXISTS "file_name" TEXT;
