-- Kullanıcılara iki adımlı doğrulama (2FA) alanları ekle
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "two_factor_secret" TEXT;
ALTER TABLE "users" ADD COLUMN "two_factor_backup_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
