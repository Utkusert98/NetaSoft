/**
 * Satış verisi kolon eşleştirme — izomorfik (server + client) paylaşılan modül.
 *
 * Bu dosya bilinçli olarak sunucuya özgü hiçbir bağımlılık içermez (xlsx, pdfjs-dist,
 * next/server vb. YOK) — böylece hem `/api/v1/satis/parse` route'unda hem de
 * `satis/rapor` sayfasında (tarayıcıda) aynı mantıkla, dosyayı tekrar yüklemeden
 * kolon eşleştirmesi (remap) yapılabilir.
 */

export interface ParsedSaleRow {
  productGroup: string;
  productName: string;
  saleDate: string;
  price: number;
  discountAmount: number;
  saleType: "PRESCRIPTION" | "RETAIL";
  quantity: number;
  netRevenue: number;
  /** Bazı POS dosyalarında bulunan personel/çalışan adı sütunu — opsiyonel,
   *  tüm dosyalarda bulunmaz. */
  staffName?: string;
  /** "İşlem Tipi" sütunundaki ham metin (ör. "P.SATIŞ (K.K.)", "REÇETELİ SATIŞ") —
   *  `saleType` ikili sınıflandırmasını DEĞİŞTİRMEDEN, ödeme yöntemi/işlem türü
   *  detayını kaybetmeden saklamak için eklendi. */
  rawTransactionType?: string;
  /** "Cari Adı"/"Müşteri Adı"/"Hasta Adı" sütunundaki müşteri/hesap adı — `productName`
   *  fallback'inden BAĞIMSIZ, kendi başına saklanan ayrı bir alan. */
  customerName?: string;
  /** "Puan Tutar" (sadakat puanı) sütunundaki tutar — opsiyonel. */
  loyaltyPoints?: number;
  /** Tarih sütunundaki HAM (ayrıştırılmamış) değer — `dateInvalid` true olduğunda
   *  kullanıcıya "hangi satır/hangi ham değer" bilgisini göstermek için saklanır. */
  rawDateValue?: string;
  /** true ise bu satırın tarih değeri ayrıştırılamadı (`isParseableDate` false döndü) —
   *  `saleDate` bu durumda `parseDate`'in sessiz bugüne-düşme fallback'ini içerir ve
   *  ASLA veritabanına kaydedilmemelidir; çağıran taraf bu satırı kayıttan HARİÇ
   *  tutmalı ve kullanıcıya bildirmelidir (gerçek bir üretim hatasının kök nedeni —
   *  bkz. isParseableDate). */
  dateInvalid?: boolean;
}

export interface ColumnMap {
  price: string;
  quantity: string;
  discount: string;
  name: string;
  date: string;
  group: string;
  type: string;
  staff: string;
  priceIsNet: boolean;
}

export interface ColumnOverride {
  price?: string;
  quantity?: string;
  discount?: string;
  name?: string;
  date?: string;
  group?: string;
  type?: string;
  staff?: string;
  priceIsNet?: boolean;
}

export interface MappedRow {
  row: ParsedSaleRow;
  colMap: ColumnMap;
}

export function parseSaleType(raw: string): "PRESCRIPTION" | "RETAIL" {
  const v = raw.toLowerCase().trim();
  if (v.includes("reçete") || v.includes("recete") || v.includes("sgk") || v.includes("prescription")) {
    return "PRESCRIPTION";
  }
  return "RETAIL";
}

/**
 * Bir işlem tipinin iade/iptal olup olmadığını tespit eder — "iade"/"return"/"iptal"
 * içeren `İşlem Tipi` değerleri (ör. "İADE", "SATIŞ İPTALİ", "RETURN"). `saleType`
 * ikili (PRESCRIPTION/RETAIL) sınıflandırmasından TAMAMEN ayrı, ek bir sinyaldir —
 * mevcut davranışı etkilemez.
 */
export function isReturnTransaction(rawType: string | undefined | null): boolean {
  if (!rawType) return false;
  // Türkçe büyük noktalı "İ" -> düz "i" (norm() ile aynı gerekçe, bkz. yukarısı).
  const v = rawType.replace(/İ/g, "i").toLowerCase().trim();
  return v.includes("iade") || v.includes("return") || v.includes("iptal");
}

/** "PERAKENDE MÜŞTERİ" gibi anonim/genel müşteri yer tutucusu mu? */
export function isGenericWalkInCustomer(name: string | undefined | null): boolean {
  if (!name) return false;
  const v = name.replace(/İ/g, "i").toLowerCase().trim()
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");
  return v === "perakende musteri" || v === "genel musteri";
}

/** Bir tarih değerini ayrıştıramadığında true döner — çağıran taraf bunu kullanarak
 *  "tüm satırlar bugüne düştü" gibi sessiz veri bozulmasını tespit edebilir. */
export function isParseableDate(raw: string): boolean {
  const s = String(raw).trim();
  if (!s) return false;
  // Sondaki saat kısmını at (ör. "10.08.2026 14:23:00" → "10.08.2026")
  const dateOnly = s.replace(/[T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?Z?$/, "").trim();
  if (/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.test(dateOnly)) return true;
  if (/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/.test(dateOnly)) return true;
  const n = Number(s);
  return !isNaN(n) && n > 25000 && n < 80000; // makul Excel seri tarih aralığı (~1968-2119)
}

export function parseDate(raw: string): string {
  const s = String(raw).trim();
  // Sondaki saat kısmını at (ör. "10.08.2026 14:23:00" → "10.08.2026") — bu
  // olmadan tarih+saat içeren hücreler ayrıştırılamıyor ve TÜM satırlar sessizce
  // bugünün tarihine düşüyordu (gerçek bir üretim hatasının kök nedeni).
  const dateOnly = s.replace(/[T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?Z?$/, "").trim();

  const dmy = dateOnly.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}T00:00:00.000Z`;
  }
  const ymd = dateOnly.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}T00:00:00.000Z`;
  const n = Number(s);
  if (!isNaN(n) && n > 25000 && n < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return d.toISOString();
  }
  return new Date().toISOString();
}

export function parseNum(raw: unknown): number {
  if (typeof raw === "number") return isNaN(raw) ? 0 : Math.abs(raw);
  const s = String(raw ?? "0").trim().replace(/\s/g, "");
  if (!s || s === "-") return 0;
  if (s.includes(",") && s.includes(".")) {
    const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : Math.abs(n);
  }
  if (s.includes(",")) {
    const n = parseFloat(s.replace(",", "."));
    return isNaN(n) ? 0 : Math.abs(n);
  }
  if (s.includes(".")) {
    const afterDot = s.split(".").pop() ?? "";
    if (afterDot.length === 3) {
      const n = parseFloat(s.replace(/\./g, ""));
      return isNaN(n) ? 0 : Math.abs(n);
    }
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.abs(n);
}

function norm(h: string): string {
  // ÖNEMLİ: JS'in .toLowerCase()'i Türkçe büyük noktalı "İ" (U+0130) harfini
  // düz "i" değil, üzerinde ayrı bir birleşik nokta işaretiyle "i̇" (U+0069 +
  // U+0307) üretir — bu da "İşlem Tipi", "İskonto Tutar" gibi İ ile başlayan
  // başlıkların "islem tipi"/"iskonto tutar" ile hiç eşleşmemesine (sessizce)
  // yol açıyordu. toLowerCase()'den ÖNCE İ'yi düz "i"ye çevirmek bunu çözer.
  return h.replace(/İ/g, "i").toLowerCase().trim()
    .replace(/\s+/g, " ")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");
}

// NOT: `claimed` seti olmadan, iki farklı alan (ör. adet ve fiyat) aynı sütuna
// atanabilirdi — bu, envanter modülünde tespit edilen ve tutarların karesi
// alınmış gibi devasa yanlış sonuçlar üreten hatanın AYNISIYDI. Artık her
// sütun yalnızca bir alana atanabiliyor, ayrıca tam eşleşme her zaman
// bulanık (substring) eşleşmeye tercih ediliyor (ör. "Fiyat" tam eşleşmesi,
// "İskonto Fiyatı" gibi başka bir sütunu içeren bulanık eşleşmeden önce gelir).
//
// `exactOnlyKeys`: bazı alias'lar ("adi", "urun", "stok", "tutar", "adet" gibi
// kısa/genel kelimeler) sadece TAM başlık eşleşmesinde güvenlidir — bulanık
// (substring) eşleşmede kullanılırsa "Adisyon No" içindeki "adi" veya
// "İskonto Tutarı" içindeki "tutar" gibi TAMAMEN İLGİSİZ bir sütunu yanlışlıkla
// yakalayabilirler (gerçek bir üretim hatasının kök nedeniydi). Bu yüzden bu
// tür kelimeler yalnızca `exactOnlyKeys` ile geçirilir, `keys` (substring'de de
// denenecek ifadeler) listesine değil.
function findIdx(headers: string[], keys: string[], claimed: Set<number>, exactOnlyKeys: string[] = []): number {
  const normalized = headers.map(norm);
  // 1. geçiş: tam eşleşme (en güvenilir) — hem substring-uygun hem exact-only alias'lar denenir
  for (const k of [...keys, ...exactOnlyKeys]) {
    const idx = normalized.findIndex((h, i) => h === k && !claimed.has(i));
    if (idx !== -1) { claimed.add(idx); return idx; }
  }
  // 2. geçiş: başlık, alias ifadesini bir bütün olarak içeriyor — SADECE substring-uygun alias'lar
  for (const k of keys) {
    const idx = normalized.findIndex((h, i) => h.includes(k) && !claimed.has(i));
    if (idx !== -1) { claimed.add(idx); return idx; }
  }
  return -1;
}

function findByName(headers: string[], name: string): number {
  return headers.findIndex(h => norm(h) === norm(name));
}

// Kolon adının "net tutar" / "tutar" gibi bir toplam gelir kolonu olup olmadığını kontrol et
function isNetCol(colName: string): boolean {
  const n = norm(colName);
  return ["net tutar", "tutar", "toplam tutar", "satis tutari", "net amount", "toplam"].some(k => n === k);
}

/**
 * Ad, tarih ve fiyat sütunları otomatik bulunduysa (miktar da bulunduysa veya
 * fiyat zaten net/toplam tutar ise) kullanıcıdan manuel kolon eşleştirmesi
 * istemeye gerek yoktur — doğrudan önizlemeye geçilebilir.
 */
export function isColumnMapConfident(colMap: ColumnMap): boolean {
  const found = (v: string) => v !== "" && v !== "(bulunamadı)" && v !== "—";
  const hasQty = colMap.priceIsNet || found(colMap.quantity);
  // Ürün adı sütunu olmayan, işlem/fiş bazlı raporlarda (ör. Cari Adı/İşlem
  // Tipi taşıyan dosyalar) satış tipi veya grup sütunu bulunması da yeterli
  // bir kimlik alanıdır — kullanıcıya anlamsız yere manuel eşleştirme sorulmaz.
  const hasIdentity = found(colMap.name) || found(colMap.type) || found(colMap.group);
  return hasIdentity && found(colMap.date) && found(colMap.price) && hasQty;
}

export function mapRow(headers: string[], row: unknown[], override: ColumnOverride): MappedRow {
  // Sütun ele geçirme sırası önemlidir: parasal tutarı doğrudan etkileyen alanlar
  // (fiyat, adet, ad, tarih) önce sütunlarını "ele geçirir" (claimed), böylece
  // daha az kritik alanlar (grup, tip, iskonto) yanlışlıkla aynı sütunu çalamaz.
  const claimed = new Set<number>();
  const gi = (col: string | undefined, keys: string[], exactOnlyKeys: string[] = []) =>
    col ? findByName(headers, col) : findIdx(headers, keys, claimed, exactOnlyKeys);
  const gv = (i: number) => i >= 0 ? row[i] : "";
  const gh = (i: number) => i >= 0 ? (headers[i] ?? "") : "(bulunamadı)";

  let priceIdx = -1;
  let priceIsNet = override.priceIsNet ?? false;

  if (override.price) {
    priceIdx = findByName(headers, override.price);
    if (override.priceIsNet === undefined) priceIsNet = isNetCol(override.price);
  } else {
    // Önce birim fiyat kolonlarını ara. "fiyat"/"birim"/"price" bare kelimeleri
    // yalnızca tam eşleşmede denenir — bulanık eşleşmede "İskonto Fiyatı" gibi
    // tamamen farklı bir sütunu yanlışlıkla yakalayabilirler.
    priceIdx = findIdx(headers, ["birim fiyat", "liste fiyati", "satis fiyati", "unit price"], claimed, ["fiyat", "price", "birim"]);
    if (priceIdx < 0) {
      // Yoksa net tutar türü kolonları bul — otomatik olarak net mod.
      // Aynı nedenle "tutar"/"toplam"/"amount" bare kelimeleri yalnızca tam
      // eşleşmede denenir (aksi halde "İskonto Tutarı" gibi bir sütunu yakalar).
      priceIdx = findIdx(headers, ["net tutar", "toplam tutar", "satis tutari", "net amount"], claimed, ["tutar", "toplam", "amount"]);
      if (priceIdx >= 0) priceIsNet = true;
    }
  }
  if (priceIdx >= 0) claimed.add(priceIdx);

  // "adet"/"miktar"/"sayi"/"qty" bare kelimeleri yalnızca tam eşleşmede denenir —
  // bulanık eşleşmede "İskonto Adedi" gibi ilgisiz bir sütunu yakalayabilirler.
  const qtyIdx   = gi(override.quantity, ["satis adedi", "satis adet", "satis miktari", "quantity"], ["adet", "miktar", "qty", "sayi"]);
  const dateIdx  = gi(override.date,     ["tarih", "date", "satis tarihi", "sale date", "islem tarihi"]);
  // "adi"/"urun"/"stok"/"name"/"product" bare kelimeleri yalnızca tam eşleşmede
  // denenir — bulanık eşleşmede "Adisyon No" veya "Stok Kodu" gibi TAMAMEN
  // İLGİSİZ bir sütunu ürün adı sanabilir (gerçek bir üretim hatasının kök nedeniydi).
  // "cari adi"/"musteri adi"/"hasta adi" — ürün adı sütunu olmayan, işlem/fiş
  // bazlı raporlarda (ör. sadece İşlem No/Cari Adı/İşlem Tipi/Tarih/Tutar
  // içeren dosyalar) ürün adı yerine kullanılabilecek en anlamlı kimlik alanı.
  const nameIdx  = gi(override.name,     ["urun adi", "ilac adi", "stok adi", "product name", "malzeme adi", "cari adi", "musteri adi", "hasta adi"], ["urun", "product", "adi", "name", "stok"]);
  const groupIdx = gi(override.group,    ["urun grubu", "urun grup", "product group", "kategori", "category", "ana grup"], ["grup", "group"]);
  // "islem tipi" — işlem/fiş bazlı raporlarda satış türünü (reçeteli/perakende)
  // taşıyan asıl sütun genelde budur.
  const typeIdx  = gi(override.type,     ["satis tipi", "satis turu", "islem tipi", "recete", "prescription"], ["tip", "type"]);
  const discIdx  = gi(override.discount, ["iskonto tutari", "iskonto tutar", "indirim tutari", "discount amount"], ["iskonto", "discount", "indirim", "ind."]);
  const discRIdx = gi(undefined,         ["iskonto %", "iskonto yuzde", "indirim %", "discount %", "discount rate"]);
  // Personel/çalışan sütunu — bilgi amaçlı, tüm dosyalarda bulunmaz.
  const staffIdx = gi(override.staff,    ["personel", "calisan", "satis personeli", "staff", "employee"], ["personel", "calisan"]);
  // Cari Adı/Müşteri Adı/Hasta Adı — `nameIdx` zaten bu alias'ları ürün adı fallback'i
  // olarak deneyebilir; burada AYRICA (nameIdx'ten bağımsız, sütunu tekrar "ele
  // geçirmeden") kendi başına customerName olarak da yakalanır.
  const customerIdx = findIdx(headers, ["cari adi", "musteri adi", "hasta adi"], new Set<number>());
  // "Puan Tutar" (sadakat puanı) — "puan" kısa/genel bir kelime olduğu için yalnızca
  // exactOnlyKeys üzerinden, tam eşleşmede denenir (bulanık eşleşmede ilgisiz bir
  // sütunu yakalamasın diye).
  const loyaltyIdx = findIdx(headers, ["puan tutar", "sadakat puani", "loyalty points"], new Set<number>(), ["puan"]);

  const priceNum = parseNum(gv(priceIdx));
  const qtyNum = Math.max(1, Math.round(parseNum(gv(qtyIdx)) || 1));

  let discountAmount = parseNum(gv(discIdx));
  if (discountAmount === 0 && discRIdx >= 0) {
    const rate = parseNum(gv(discRIdx));
    if (rate > 0 && rate <= 100) {
      discountAmount = priceIsNet ? priceNum * (rate / 100) : priceNum * qtyNum * (rate / 100);
    }
  }

  let finalPrice: number;
  let finalQty: number;
  let finalDiscount: number;
  let netRevenue: number;

  if (priceIsNet) {
    // priceNum zaten net tutar (iskonto düşülmüş nihai tutar) — adete bölme,
    // quantity=1. discountAmount yalnızca bilgi amaçlı gösterim için saklanır;
    // netRevenue'dan TEKRAR düşülmez — aksi halde iskonto çift sayılıp ciro
    // olduğundan düşük hesaplanır (ör. "Toplam Tutar/İskonto Tutar/Net Tutar"
    // üçlüsü olan dosyalarda Net Tutar zaten son tutardır).
    finalPrice   = priceNum;
    finalQty     = 1;
    finalDiscount = discountAmount;
    netRevenue   = priceNum;
  } else {
    finalPrice   = priceNum;
    finalQty     = qtyNum;
    finalDiscount = discountAmount;
    netRevenue   = finalPrice * finalQty - finalDiscount;
  }

  const rawDateVal = String(gv(dateIdx) ?? "");

  return {
    row: {
      productGroup:   String(gv(groupIdx) ?? "").trim() || "Genel",
      productName:    String(gv(nameIdx) ?? "").trim() || "Bilinmiyor",
      saleDate:       parseDate(rawDateVal),
      price:          finalPrice,
      discountAmount: finalDiscount,
      saleType:       parseSaleType(String(gv(typeIdx) ?? "")),
      quantity:       finalQty,
      netRevenue,
      staffName:      staffIdx >= 0 ? (String(gv(staffIdx) ?? "").trim() || undefined) : undefined,
      rawTransactionType: typeIdx >= 0 ? (String(gv(typeIdx) ?? "").trim() || undefined) : undefined,
      customerName:   customerIdx >= 0 ? (String(gv(customerIdx) ?? "").trim() || undefined) : undefined,
      loyaltyPoints:  loyaltyIdx >= 0 ? parseNum(gv(loyaltyIdx)) : undefined,
      rawDateValue:   rawDateVal,
      dateInvalid:    !isParseableDate(rawDateVal),
    },
    colMap: {
      price:      gh(priceIdx),
      quantity:   priceIsNet ? "—" : gh(qtyIdx),
      discount:   gh(discIdx >= 0 ? discIdx : discRIdx),
      name:       gh(nameIdx),
      date:       gh(dateIdx),
      group:      gh(groupIdx),
      type:       gh(typeIdx),
      staff:      gh(staffIdx),
      priceIsNet,
    },
  };
}
