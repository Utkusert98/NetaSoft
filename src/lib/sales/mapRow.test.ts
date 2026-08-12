import { describe, it, expect } from "vitest";
import { mapRow, isColumnMapConfident, parseDate, isParseableDate, isReturnTransaction, isGenericWalkInCustomer } from "./mapRow";

describe("mapRow — sütun çakışması koruması", () => {
  // Birden fazla benzer isimli sütun içeren, gerçekçi bir zorlayıcı başlık seti:
  // hem "Fiyat" hem "İskonto Fiyatı" var; hem "Adet" hem "İskonto Adedi" var.
  // Eski (claimed seti olmayan) algoritma bunlardan yanlışını seçebilirdi.
  const headers = ["Tarih", "Ürün Adı", "Ürün Grubu", "Adet", "İskonto Adedi", "Fiyat", "İskonto Fiyatı", "Satış Tipi"];
  const row = ["10.08.2026", "PAROL 500 MG", "İLAÇ", "3", "0", "45.90", "0", "Perakende"];

  it("fiyat ve adet farklı sütunlara atanır, hiçbiri çakışmaz", () => {
    const { colMap } = mapRow(headers, row, {});
    expect(colMap.price).toBe("Fiyat");
    expect(colMap.quantity).toBe("Adet");
    expect(colMap.price).not.toBe(colMap.quantity);
  });

  it("fiyat × adet doğru hesaplanır (kare alma hatası yok)", () => {
    const { row: mapped } = mapRow(headers, row, {});
    expect(mapped.price).toBeCloseTo(45.9, 2);
    expect(mapped.quantity).toBe(3);
    expect(mapped.netRevenue).toBeCloseTo(137.7, 2);
  });

  it("ürün adı ve tarih doğru eşlenir", () => {
    const { row: mapped } = mapRow(headers, row, {});
    expect(mapped.productName).toBe("PAROL 500 MG");
    expect(mapped.saleDate.startsWith("2026-08-10")).toBe(true);
  });

  it("tam eşleşme her zaman bulanık eşleşmeden önce gelir", () => {
    // "Fiyat" tam eşleşmesi, "İskonto Fiyatı" gibi "fiyat" içeren başka bir
    // sütunun bulanık eşleşmesinden önce seçilmelidir.
    const { colMap } = mapRow(headers, row, {});
    expect(colMap.price).not.toBe("İskonto Fiyatı");
  });

  it("bu eşleştirme güvenilir sayılır (manuel düzenleme gerekmez)", () => {
    const { colMap } = mapRow(headers, row, {});
    expect(isColumnMapConfident(colMap)).toBe(true);
  });
});

describe("mapRow — net tutar modu", () => {
  const headers = ["Tarih", "Ürün Adı", "Net Tutar"];
  const row = ["10.08.2026", "OZEMPIC 1 MG", "1250.00"];

  it("net tutar sütunu adete bölünmez, quantity=1 olarak kaydedilir", () => {
    const { row: mapped, colMap } = mapRow(headers, row, {});
    expect(colMap.priceIsNet).toBe(true);
    expect(mapped.price).toBeCloseTo(1250, 2);
    expect(mapped.quantity).toBe(1);
    expect(mapped.netRevenue).toBeCloseTo(1250, 2);
  });
});

describe("mapRow — net tutar + ayrı iskonto tutarı sütunu (gerçek üretim hatası)", () => {
  // Gerçek hata: "Toplam Tutar / İskonto Tutar / Net Tutar" üçlüsü olan dosyalarda
  // Net Tutar zaten iskonto düşülmüş nihai tutardır. Eskiden İskonto Tutar ayrıca
  // netRevenue'dan bir kez daha düşülüyordu — ciro olduğundan az hesaplanıyordu.
  const headers = ["İşlem No", "Cari Adı", "İşlem Tipi", "Tarih", "Toplam Tutar", "İskonto Tutar", "Net Tutar", "Personel"];
  const row = ["21159", "PERAKENDE MÜŞTERİ", "P. SATIŞ", "01/07/2026", "152.62", "2.62", "150.00", "KASA"];

  it("iskonto çift sayılmaz, netRevenue = Net Tutar sütunundaki değerdir", () => {
    const { row: mapped } = mapRow(headers, row, {});
    expect(mapped.netRevenue).toBeCloseTo(150, 2);
    expect(mapped.price).toBeCloseTo(150, 2);
  });
});

describe("mapRow — ürün adı sütunu olmayan, işlem/fiş bazlı dosya (gerçek üretim dosyası)", () => {
  // Gerçek bir hata: bazı POS/eczane yazılımları ürün kırılımı olmayan, işlem
  // bazlı bir özet dosyası verir (İşlem No, Cari Adı, İşlem Tipi, Tarih, Net
  // Tutar). Ürün adı sütunu hiç yoktur; eskiden bu yüzden isColumnMapConfident
  // false dönüyor ve kullanıcıya gereksiz yere manuel kolon eşleştirmesi
  // soruluyordu. Ayrıca "İşlem Tipi"/"İskonto Tutar" gibi büyük noktalı "İ" ile
  // başlayan başlıklar, JS'in Türkçe olmayan toLowerCase() davranışı yüzünden
  // hiç eşleşmiyordu (ayrı bir kök neden, aynı dosyada ortaya çıktı).
  const headers = ["İşlem No", "Cari Adı", "İşlem Tipi", "Tarih", "Toplam Tutar", "İskonto Tutar", "Net Tutar", "Personel", "Puan Tutar"];
  const row = ["21149", "NAZİK YERŞEN", "REÇETELİ SATIŞ", "01/07/2026", "24010.08", "0.00", "24010.08", "Havan Soft", "0.00"];

  it("kolon eşleştirmesi manuel müdahale olmadan güvenilir sayılır", () => {
    const { colMap } = mapRow(headers, row, {});
    expect(colMap.type).toBe("İşlem Tipi");
    expect(colMap.price).toBe("Net Tutar");
    expect(isColumnMapConfident(colMap)).toBe(true);
  });

  it("'İşlem Tipi' sütunu doğru bulunur ve reçeteli satış doğru sınıflandırılır", () => {
    const { row: mapped } = mapRow(headers, row, {});
    expect(mapped.saleType).toBe("PRESCRIPTION");
    expect(mapped.netRevenue).toBeCloseTo(24010.08, 2);
  });
});

describe("parseDate — tarih+saat ve gerçek üretim hatası senaryosu", () => {
  it("saat eki olan tarihleri doğru ayrıştırır (önceden bugüne düşüyordu)", () => {
    const iso = parseDate("10.08.2026 14:23:00");
    expect(iso.startsWith("2026-08-10")).toBe(true);
  });

  it("saat eki + milisaniye/Z olan ISO benzeri değerleri de ayrıştırır", () => {
    const iso = parseDate("2026-08-10 14:23:00.000");
    expect(iso.startsWith("2026-08-10")).toBe(true);
  });

  it("2 haneli yıl içeren tarihleri 20xx olarak yorumlar", () => {
    const iso = parseDate("10.08.26");
    expect(iso.startsWith("2026-08-10")).toBe(true);
  });

  it("gerçekten ayrıştırılamayan bir değeri isParseableDate ile false olarak işaretler", () => {
    expect(isParseableDate("Adisyon #48213")).toBe(false);
    expect(isParseableDate("10.08.2026 14:23:00")).toBe(true);
  });
});

describe("mapRow — ilgisiz sütunların ürün adı/tarih sanılması hatası (gerçek üretim hatası)", () => {
  // Gerçek bir hata: "Adisyon No" (fiş numarası, artan tam sayı) sütunu, "adi"
  // bare alias'ı yüzünden "Ürün Adı" sanılıyordu; tarih sütunu saat eki içerdiği
  // için ayrıştırılamayıp TÜM satırlar bugünün tarihine düşüyordu.
  const headers = ["Adisyon No", "İşlem Tarihi", "Ürün Adı", "Ürün Grubu", "Adet", "Fiyat", "Satış Tipi"];
  const row = ["27204", "10.08.2026 14:23:00", "PAROL 500 MG", "İLAÇ", "3", "45.90", "Perakende"];

  it("'Adisyon No' ürün adı sütunu olarak yakalanmaz", () => {
    const { colMap } = mapRow(headers, row, {});
    expect(colMap.name).toBe("Ürün Adı");
    expect(colMap.name).not.toBe("Adisyon No");
  });

  it("ürün adı gerçek ürün adını taşır, sıra numarasını değil", () => {
    const { row: mapped } = mapRow(headers, row, {});
    expect(mapped.productName).toBe("PAROL 500 MG");
    expect(mapped.productName).not.toBe("27204");
  });

  it("saat ekli tarih doğru ayrıştırılır, bugüne düşmez", () => {
    const { row: mapped } = mapRow(headers, row, {});
    expect(mapped.saleDate.startsWith("2026-08-10")).toBe(true);
  });
});

describe("mapRow — rawTransactionType / customerName / loyaltyPoints (gerçek üretim dosyası)", () => {
  const headers = ["İşlem No", "Cari Adı", "İşlem Tipi", "Tarih", "Toplam Tutar", "İskonto Tutar", "Net Tutar", "Personel", "Puan Tutar"];
  const row = ["21159", "PERAKENDE MÜŞTERİ", "P.SATIŞ (K.K.)", "01/07/2026", "152.62", "2.62", "150.00", "KASA", "0.00"];

  it("rawTransactionType ham işlem tipi metnini saklar, saleType binary sınıflandırmasını değiştirmez", () => {
    const { row: mapped } = mapRow(headers, row, {});
    expect(mapped.rawTransactionType).toBe("P.SATIŞ (K.K.)");
    expect(mapped.saleType).toBe("RETAIL");
  });

  it("customerName, productName fallback'inden bağımsız kendi başına yakalanır", () => {
    const { row: mapped } = mapRow(headers, row, {});
    expect(mapped.customerName).toBe("PERAKENDE MÜŞTERİ");
    // Bu dosyada ürün adı sütunu yok, bu yüzden Cari Adı productName fallback'i olarak da kullanılır.
    expect(mapped.productName).toBe("PERAKENDE MÜŞTERİ");
  });

  it("loyaltyPoints '0.00' değerini 0 olarak ayrıştırır (all-zero örnek veri)", () => {
    const { row: mapped } = mapRow(headers, row, {});
    expect(mapped.loyaltyPoints).toBe(0);
  });

  it("Puan Tutar > 0 olduğunda doğru ayrıştırılır", () => {
    const rowWithPoints = ["21160", "AHMET YILMAZ", "REÇETELİ SATIŞ", "01/07/2026", "100.00", "0.00", "100.00", "KASA", "15.50"];
    const { row: mapped } = mapRow(headers, rowWithPoints, {});
    expect(mapped.loyaltyPoints).toBeCloseTo(15.5, 2);
  });

  it("'puan' bare alias'ı yalnızca tam eşleşmede denenir, ilgisiz sütunu yanlış yakalamaz", () => {
    const headersNoPointsCol = ["İşlem No", "Cari Adı", "İşlem Tipi", "Tarih", "Net Tutar"];
    const rowNoPoints = ["1", "AHMET", "P. SATIŞ", "01/07/2026", "50.00"];
    const { row: mapped } = mapRow(headersNoPointsCol, rowNoPoints, {});
    expect(mapped.loyaltyPoints).toBeUndefined();
  });
});

describe("isReturnTransaction — iade/iptal tespiti", () => {
  it("'İADE' içeren işlem tiplerini iade olarak işaretler", () => {
    expect(isReturnTransaction("İADE")).toBe(true);
    expect(isReturnTransaction("SATIŞ İADESİ")).toBe(true);
    expect(isReturnTransaction("SATIŞ İPTALİ")).toBe(true);
    expect(isReturnTransaction("RETURN")).toBe(true);
  });

  it("normal satış tiplerini iade olarak işaretlemez", () => {
    expect(isReturnTransaction("P.SATIŞ (K.K.)")).toBe(false);
    expect(isReturnTransaction("REÇETELİ SATIŞ")).toBe(false);
    expect(isReturnTransaction(undefined)).toBe(false);
    expect(isReturnTransaction("")).toBe(false);
  });
});

describe("mapRow — tek satırlık bozuk tarih, sessizce bugüne düşmez ve işaretlenir (gerçek üretim hatası regresyonu)", () => {
  // Gerçek, tekrarlayan üretim hatası: 1500+ satırlık bir dosyada TEK bir satırın
  // tarih hücresi boş/bozuk/birleştirilmiş olduğunda, eskiden bu satır sessizce
  // BUGÜNÜN tarihine düşüyor ve rakamı ait olmadığı bir aya (ör. Ağustos) hayalet
  // bir "1 satış" olarak sızdırıyordu. `looksLikeDateFallback` sayfa kontrolü
  // yalnızca TÜM/ÇOĞU satır aynı tarihe yığıldığında (>=5 satır, tek distinct tarih)
  // devreye girer — 5 iyi satır arasındaki TEK bozuk satırı YAKALAMAZ. Bu test,
  // mapRow'un artık her satırı `dateInvalid` ile ayrı ayrı işaretlediğini ve
  // sağlam satırların normal şekilde ayrıştırılmaya devam ettiğini doğrular.
  const headers = ["Tarih", "Ürün Adı", "Fiyat", "Adet"];
  const goodRows: unknown[][] = [
    ["01.07.2026", "PAROL 500 MG", "45.90", "2"],
    ["05.07.2026", "AUGMENTIN 1G", "120.00", "1"],
    ["12.07.2026", "NUROFEN 400", "38.50", "3"],
    ["18.07.2026", "VOLTAREN JEL", "95.00", "1"],
    ["27.07.2026", "OZEMPIC 1MG", "1250.00", "1"],
  ];
  const badRow = ["", "PARASETAMOL 500MG", "12.00", "1"]; // boş/bozuk tarih hücresi

  it("iyi satırların 5'i de dateInvalid=false ile Temmuz'a doğru ayrıştırılır", () => {
    const results = goodRows.map(r => mapRow(headers, r, {}).row);
    for (const r of results) {
      expect(r.dateInvalid).toBe(false);
      expect(r.saleDate.slice(0, 7)).toBe("2026-07");
    }
  });

  it("bozuk tarihli TEK satır dateInvalid=true olarak işaretlenir (sessizce bugüne düşmez sayılmaz)", () => {
    const { row: mapped } = mapRow(headers, badRow, {});
    expect(mapped.dateInvalid).toBe(true);
    expect(mapped.rawDateValue).toBe("");
    // parseDate hâlâ dahili olarak bugüne düşer (geriye dönük uyumluluk için saleDate
    // dolu kalır) — ama çağıran taraf (satis/rapor sayfası) dateInvalid=true olan
    // satırları KAYDETMEDEN önce filtrelemekle yükümlüdür (bkz. page.tsx validPreviewRows).
    expect(mapped.saleDate).toBeTruthy();
  });

  it("karışık 6 satırlık (5 iyi + 1 bozuk) bir dosyada looksLikeDateFallback'in kaçırdığı senaryoda bile, dateInvalid filtrelemesi bozuk satırı doğru şekilde dışlar", () => {
    const allRows = [...goodRows, badRow].map(r => mapRow(headers, r, {}).row);
    const valid = allRows.filter(r => !r.dateInvalid);
    const invalid = allRows.filter(r => r.dateInvalid);
    expect(valid.length).toBe(5);
    expect(invalid.length).toBe(1);
    expect(invalid[0].productName).toBe("PARASETAMOL 500MG");
    // Sağlam satırların hiçbiri bugünün tarihine (test ortamının çalıştığı gün)
    // yanlışlıkla düşmemiştir — hepsi Temmuz 2026'dadır.
    for (const r of valid) expect(r.saleDate.slice(0, 7)).toBe("2026-07");
  });
});

describe("mapRow — 'Satış Adet'/'Ürün Grup' (tekil) başlık varyantları (gerçek üretim dosyası)", () => {
  // Gerçek hata: bazı POS dosyalarında adet sütunu "Satış Adedi" değil "Satış
  // Adet" (sonda 'i' yok), grup sütunu da "Ürün Grubu" değil "Ürün Grup"
  // (sonda 'u' yok) olarak geçiyor. Eski alias listeleri bu tekil biçimleri
  // tanımıyordu — adet bulunamayınca her satır miktar=1 varsayıyordu, bu da
  // birden fazla adet satılan satırlarda ciroyu ciddi şekilde (bu dosyada
  // ~%264) düşük hesaplıyordu.
  const headers = ["İşlem No", "Tarih", "İşlem Tipi", "Ürün Grup", "Ürün Adı", "Satış Adet", "Birim Fiyat", "Toplam Tutar", "İskonto Tutar", "Net Tutar", "Personel"];
  const row = ["22803", "01/08/2026", "P.SATIŞ (K.K.)", "İLAÇ", "RENNIE 680 80 MG 48 CIGNEME TB.", "2", "298.63", "597.26", "0.00", "597.26", "KASA"];

  it("'Satış Adet' (tekil) sütunu adet olarak doğru bulunur", () => {
    const { colMap } = mapRow(headers, row, {});
    expect(colMap.quantity).toBe("Satış Adet");
  });

  it("'Ürün Grup' (tekil) sütunu grup olarak doğru bulunur", () => {
    const { colMap } = mapRow(headers, row, {});
    expect(colMap.group).toBe("Ürün Grup");
  });

  it("adet doğru okunduğu için ciro (fiyat×adet) doğru hesaplanır, 1 varsayılmaz", () => {
    const { row: mapped } = mapRow(headers, row, {});
    expect(mapped.quantity).toBe(2);
    expect(mapped.netRevenue).toBeCloseTo(597.26, 2);
  });

  it("bu eşleştirme manuel müdahale gerektirmeden güvenilir sayılır", () => {
    const { colMap } = mapRow(headers, row, {});
    expect(isColumnMapConfident(colMap)).toBe(true);
  });
});

describe("isGenericWalkInCustomer — anonim müşteri yer tutucusu tespiti", () => {
  it("'PERAKENDE MÜŞTERİ' değerini genel/anonim olarak işaretler", () => {
    expect(isGenericWalkInCustomer("PERAKENDE MÜŞTERİ")).toBe(true);
    expect(isGenericWalkInCustomer("perakende musteri")).toBe(true);
  });

  it("gerçek müşteri adlarını genel olarak işaretlemez", () => {
    expect(isGenericWalkInCustomer("AHMET YILMAZ")).toBe(false);
    expect(isGenericWalkInCustomer(undefined)).toBe(false);
  });
});
