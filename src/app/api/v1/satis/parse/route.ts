import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { apiError, apiResponse } from "@/lib/utils";

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

function parseSaleType(raw: string): "PRESCRIPTION" | "RETAIL" {
  const v = raw.toLowerCase().trim();
  if (v.includes("reçete") || v.includes("recete") || v.includes("sgk") || v.includes("prescription")) {
    return "PRESCRIPTION";
  }
  return "RETAIL";
}

function parseDate(raw: string): string {
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

function parseNum(raw: unknown): number {
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

interface MappedRow { row: ParsedSaleRow; colMap: ColumnMap }

function mapRow(headers: string[], row: unknown[], override: ColumnOverride): MappedRow {
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

export async function POST(req: NextRequest): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return apiError("Yetkisiz", "UNAUTHORIZED", 401);

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") return apiError("Dosya bulunamadı", "NO_FILE", 400);

    const overrideRaw = formData.get("columnOverride");
    const override: ColumnOverride = overrideRaw && typeof overrideRaw === "string"
      ? (JSON.parse(overrideRaw) as ColumnOverride)
      : {};

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();

    let headers: string[] = [];
    let dataRows: unknown[][] = [];

    if (name.endsWith(".csv")) {
      const text = buffer.toString("utf-8");
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return apiError("CSV boş veya geçersiz", "EMPTY_FILE", 400);
      const sep = lines[0].includes(";") ? ";" : ",";
      headers = lines[0].split(sep).map(h => h.replace(/^"|"$/g, "").trim());
      dataRows = lines.slice(1).map(l => l.split(sep).map(c => c.replace(/^"|"$/g, "").trim()));

    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
      if (data.length < 2) return apiError("Excel boş veya geçersiz", "EMPTY_FILE", 400);
      headers = (data[0] as unknown[]).map(h => String(h));
      dataRows = data.slice(1) as unknown[][];

    } else if (name.endsWith(".pdf")) {
      let pdfjs: typeof import("pdfjs-dist");
      try {
        pdfjs = await import("pdfjs-dist");
        if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = "";
      } catch {
        return apiError("PDF modülü yüklenemedi", "PDF_MODULE_ERROR", 500);
      }
      const uint8 = new Uint8Array(buffer);
      const pdf = await pdfjs.getDocument({ data: uint8, useWorkerFetch: false, useSystemFonts: true }).promise;
      const lines: string[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        lines.push(content.items.filter(i => "str" in i).map(i => (i as { str: string }).str).join(" "));
      }
      const fullText = lines.join("\n");
      const pdfRows: ParsedSaleRow[] = fullText.split(/\n/)
        .filter(l => l.trim().length > 5)
        .slice(1)
        .flatMap(line => {
          const parts = line.trim().split(/\s{2,}|\t/);
          if (parts.length < 3) return [];
          const priceNum = parseNum(parts[2]);
          return [{
            productGroup: "Genel",
            productName: parts[0] ?? "Bilinmiyor",
            saleDate: parseDate(parts[1] ?? ""),
            price: priceNum,
            discountAmount: parseNum(parts[3]),
            saleType: parseSaleType(parts[4] ?? ""),
            quantity: 1,
            netRevenue: priceNum,
          }];
        });
      if (!pdfRows.length) return apiError("PDF'den satış verisi okunamadı", "NO_DATA", 400);
      return apiResponse({ rows: pdfRows, total: pdfRows.length, columnMap: null, headers: [] });

    } else {
      return apiError("Desteklenmeyen dosya formatı. CSV, Excel veya PDF yükleyin.", "INVALID_FORMAT", 400);
    }

    const rows: ParsedSaleRow[] = [];
    let columnMap: ColumnMap | null = null;

    for (const rowData of dataRows) {
      if ((rowData as unknown[]).every(c => !c)) continue;
      const mapped = mapRow(headers, rowData as unknown[], override);
      if (!columnMap) columnMap = mapped.colMap;
      rows.push(mapped.row);
    }

    if (!rows.length) return apiError("Dosyadan satış verisi okunamadı", "NO_DATA", 400);

    return apiResponse({ rows, total: rows.length, columnMap, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Dosya işlenemedi";
    return apiError(msg, "PARSE_ERROR", 500);
  }
}
