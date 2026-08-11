-- Dosya yüklemeleri için soft delete sütunu ekle (kullanıcı yükleme geçmişinden kaydı kaldırabilir)
ALTER TABLE "file_imports" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Soft-delete filtreli sorgular için index
CREATE INDEX "file_imports_deleted_at_idx" ON "file_imports"("deleted_at");
