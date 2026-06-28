# NetaSoft — Agent Yönergeleri

## Proje Hakkında
NetaSoft, eczaneler için geliştirilmiş kapsamlı bir finansal yönetim sistemidir.
Next.js 15 (App Router), PostgreSQL, Prisma ORM ve NextAuth.js v5 üzerine inşa edilmiştir.

## Zorunlu Kurallar

### 1. Capital Case
Tüm UI metinleri (başlıklar, tablo başlıkları, buton metinleri, form etiketleri) Capital Case olmalıdır.
- ✅ "Eczane Adı", "Toplam Gelir", "Fatura Listesi"
- ❌ "eczane adı", "toplam gelir", "fatura listesi"

### 2. Türkçe UI
Tüm kullanıcıya görünen metinler Türkçe olmalıdır.
- Hata mesajları Türkçe
- Form etiketleri Türkçe
- Bildirimler Türkçe

### 3. Dosya Yükleme Onay Akışı
Hiçbir dosya (PDF/Excel/CSV) direkt veritabanına yazılMAZ.
Zorunlu akış: Yükle → Parse → **Onay Ekranı** → Veritabanı

### 4. Şifre Politikası (Katı)
- Minimum 12 karakter
- En az 1 büyük harf, 1 küçük harf, 1 rakam, 1 özel karakter
- Yaygın şifreler yasak
- Email ile aynı olamaz

### 5. Veritabanı İlkeleri
- Her tablo `created_at`, `updated_at` sütunlarına sahip olmalı
- Soft delete: `deleted_at` nullable timestamp
- Audit log: Kritik değişiklikler `audit_logs` tablosuna yazılmalı
- Index stratejisi: Sık kullanılan sorgular için composite index

### 6. API Kuralları
- Tüm API endpoint'leri `/api/v1/` prefix'i ile başlar
- JWT ile korunan endpoint'lerde session kontrolü yapılır
- Hata yanıtları standart format: `{ success: false, error: string, code: string }`
- Başarı yanıtları: `{ success: true, data: T }`

### 7. TypeScript Strict Mode
- `any` tipi kullanılmaz
- Tüm fonksiyonlar dönüş tipi belirtir
- Zod ile runtime validasyon

## Teknoloji Stack
- **Framework**: Next.js 15 (App Router)
- **Dil**: TypeScript (strict)
- **Veritabanı**: PostgreSQL + Prisma
- **Auth**: NextAuth.js v5 (Auth.js)
- **Validasyon**: Zod
- **CSS**: Vanilla CSS (global stylesheet)
- **Dosya**: xlsx + pdfjs-dist

## Klasör Yapısı
```
src/
├── app/           # Next.js App Router
│   ├── (auth)/    # Kimlik doğrulama sayfaları
│   └── (dashboard)/ # Korumalı sayfalar
├── components/    # React bileşenleri
├── lib/           # Yardımcı kütüphaneler
└── types/         # TypeScript tipleri
prisma/            # Veritabanı şeması
```
