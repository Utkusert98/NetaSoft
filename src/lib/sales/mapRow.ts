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
}

export interface ColumnMap {
  price: string;
  quantity: string;
  discount: string;
  name: string;
  date: string;
  group: string;
  type: string;
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

export function parseDate(raw: string): string {
  const s = String(raw).trim();
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}T00:00:00.000Z`;
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00.000Z`;
  const n = Number(s);
  if (!isNaN(n) && n > 40000) {
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
  return h.toLowerCase().trim()
    .replace(/\s+/g, " ")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");
}

function findIdx(headers: string[], keys: string[]): number {
  for (const k of keys) {
    const idx = headers.findIndex(h => norm(h).includes(k));
    if (idx >= 0) return idx;
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

export function mapRow(headers: string[], row: unknown[], override: ColumnOverride): MappedRow {
  const gi = (col: string | undefined, keys: string[]) =>
    col ? findByName(headers, col) : findIdx(headers, keys);
  const gv = (i: number) => i >= 0 ? row[i] : "";
  const gh = (i: number) => i >= 0 ? (headers[i] ?? "") : "(bulunamadı)";

  const dateIdx  = gi(override.date,     ["tarih", "date", "satis tarihi", "sale date", "islem tarihi"]);
  const nameIdx  = gi(override.name,     ["urun adi", "ilac adi", "stok adi", "product name", "urun", "product", "adi", "name", "stok"]);
  const groupIdx = gi(override.group,    ["urun grubu", "grup", "group", "product group", "kategori", "category", "ana grup"]);
  const typeIdx  = gi(override.type,     ["satis tipi", "satis turu", "tip", "type", "recete", "prescription"]);
  const qtyIdx   = gi(override.quantity, ["adet", "miktar", "quantity", "qty", "sayi", "satis adedi"]);
  const discIdx  = gi(override.discount, ["iskonto tutari", "iskonto tutar", "indirim tutari", "iskonto", "discount amount", "discount", "indirim", "ind."]);
  const discRIdx = gi(undefined,         ["iskonto %", "iskonto yuzde", "indirim %", "discount %", "discount rate"]);

  let priceIdx = -1;
  let priceIsNet = override.priceIsNet ?? false;

  if (override.price) {
    priceIdx = findByName(headers, override.price);
    if (override.priceIsNet === undefined) priceIsNet = isNetCol(override.price);
  } else {
    // Önce birim fiyat kolonlarını ara
    priceIdx = findIdx(headers, ["birim fiyat", "liste fiyati", "satis fiyati", "fiyat", "price", "birim", "unit price"]);
    if (priceIdx < 0) {
      // Yoksa net tutar türü kolonları bul — otomatik olarak net mod
      priceIdx = findIdx(headers, ["net tutar", "tutar", "toplam", "amount", "net amount"]);
      if (priceIdx >= 0) priceIsNet = true;
    }
  }

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
    // priceNum zaten toplam gelir — adete bölme, quantity=1
    finalPrice   = priceNum;
    finalQty     = 1;
    finalDiscount = discountAmount;
    netRevenue   = priceNum - discountAmount;
  } else {
    finalPrice   = priceNum;
    finalQty     = qtyNum;
    finalDiscount = discountAmount;
    netRevenue   = finalPrice * finalQty - finalDiscount;
  }

  return {
    row: {
      productGroup:   String(gv(groupIdx) ?? "").trim() || "Genel",
      productName:    String(gv(nameIdx) ?? "").trim() || "Bilinmiyor",
      saleDate:       parseDate(String(gv(dateIdx) ?? "")),
      price:          finalPrice,
      discountAmount: finalDiscount,
      saleType:       parseSaleType(String(gv(typeIdx) ?? "")),
      quantity:       finalQty,
      netRevenue,
    },
    colMap: {
      price:      gh(priceIdx),
      quantity:   priceIsNet ? "—" : gh(qtyIdx),
      discount:   gh(discIdx >= 0 ? discIdx : discRIdx),
      name:       gh(nameIdx),
      date:       gh(dateIdx),
      group:      gh(groupIdx),
      type:       gh(typeIdx),
      priceIsNet,
    },
  };
}
