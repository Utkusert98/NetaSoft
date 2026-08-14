-- Soft-delete edilmiş (deleted_at dolu) bir daily_registers kaydı,
-- eski düz benzersizlik kısıtı yüzünden aynı (pharmacy_id, register_date)
-- için yeniden kayıt oluşturulmasını SONSUZA KADAR engelliyordu — silinmiş
-- kayıt hiçbir yerde görünmese de (liste, "zaten var mı" ön kontrolü)
-- benzersizlik index'ini işgal etmeye devam ediyordu. Gerçek bir üretim
-- olayıyla tespit edildi: kullanıcı bir toplu yüklemeyi sildikten sonra
-- aynı tarihleri yeniden yüklemeye çalıştığında hiçbir hata almadan
-- (skipDuplicates) sessizce 0 kayıt ekleniyordu.
--
-- Çözüm: düz benzersizlik kısıtı kaldırılır, yerine yalnızca AKTİF
-- (deleted_at IS NULL) kayıtları kapsayan kısmi bir benzersiz index
-- eklenir. Silinmiş kayıtlar artık aynı tarihin yeniden kullanılmasını
-- engellemez.
DROP INDEX IF EXISTS "daily_registers_pharmacy_id_register_date_key";

CREATE UNIQUE INDEX "daily_registers_pharmacy_id_register_date_active_key"
  ON "daily_registers"("pharmacy_id", "register_date")
  WHERE "deleted_at" IS NULL;
