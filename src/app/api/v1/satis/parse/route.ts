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
}

export interface ColumnMap {
  price: string;
  quantity: string;
  discount: string;
  name: string;
  date: string;
  group: string;
  type: string;
}

// Satır tipi eşleme — yaygın Türkçe ifadeler
function parseSaleType(raw: string): "PRESCRIPTION" | "RETAIL" {
  const v = raw.toLowerCase().trim();
  if (v.includes("reçete") || v.includes("recete") || v.includes("sgk") || v.includes("prescription")) {
    return "PRESCRIPTION";
  }
  return "RETAIL";
}

// Türkçe tarih biçimleri: dd.MM.yyyy, dd/MM/yyyy, yyyy-MM-dd → ISO datetime
function parseDate(raw: string): string {
  const s = String(raw).trim();
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}T00:00:00.000Z`;
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00.000Z`;
  // Excel serial date number
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
  // Türkçe format: hem "." hem "," var → "1.234,56" → 1234.56
  if (s.includes(",") && s.includes(".")) {
    const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : Math.abs(n);
  }
  // Sadece "," var → ondalık ayracı: "1234,56" → 1234.56
  if (s.includes(",")) {
    const n = parseFloat(s.replace(",", "."));
    return isNaN(n) ? 0 : Math.abs(n);
  }
  // Sadece "." var → 3 basamaklıysa binlik ayraç: "1.234" → 1234
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

// Kolon adlarını normalize et
function normalizeHeader(h: string): string {
  return h.toLowerCase().trim()
    .replace(/\s+/g, " ")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");
}

// Kolon adını bul ve hem değeri hem bulunan başlığı döndür
function getWithHeader(headers: string[], row: unknown[], keys: string[]): { value: unknown; header: string } {
  for (const k of keys) {
    const idx = headers.findIndex(h => normalizeHeader(h).includes(k));
    if (idx >= 0) return { value: row[idx], header: headers[idx] ?? "" };
  }
  return { value: "", header: "(bulunamadı)" };
}

interface MappedRow { row: ParsedSaleRow; columnMap: ColumnMap }

function mapRow(headers: string[], row: unknown[]): MappedRow {
  const date   = getWithHeader(headers, row, ["tarih", "date", "satis tarihi", "sale date", "islem tarihi"]);
  const price  = getWithHeader(headers, row, ["birim fiyat", "liste fiyati", "satis fiyati", "fiyat", "price", "birim", "unit price", "tutar", "amount", "net tutar"]);
  const disc   = getWithHeader(headers, row, ["iskonto tutari", "iskonto tutar", "indirim tutari", "iskonto", "discount amount", "discount", "indirim", "ind."]);
  const discR  = getWithHeader(headers, row, ["iskonto %", "iskonto yuzde", "indirim %", "discount %", "discount rate"]);
  const type   = getWithHeader(headers, row, ["satis tipi", "satis turu", "tip", "type", "recete", "prescription", "recete"]);
  const group  = getWithHeader(headers, row, ["urun grubu", "grup", "group", "product group", "kategori", "category", "ana grup"]);
  const name   = getWithHeader(headers, row, ["urun adi", "ilac adi", "stok adi", "product name", "urun", "product", "adi", "name", "stok"]);
  const qty    = getWithHeader(headers, row, ["adet", "miktar", "quantity", "qty", "sayi", "satis adedi"]);

  const qtyNum = Math.max(1, Math.round(parseNum(qty.value) || 1));
  const priceNum = parseNum(price.value);
  let discountAmount = parseNum(disc.value);
  if (discountAmount === 0 && discR.value) {
    const rate = parseNum(discR.value);
    if (rate > 0 && rate <= 100) discountAmount = priceNum * qtyNum * (rate / 100);
  }

  return {
    row: {
      productGroup: String(group.value ?? "").trim() || "Genel",
      productName: String(name.value ?? "").trim() || "Bilinmiyor",
      saleDate: parseDate(String(date.value ?? "")),
      price: priceNum,
      discountAmount,
      saleType: parseSaleType(String(type.value ?? "")),
      quantity: qtyNum,
    },
    columnMap: {
      price: price.header,
      quantity: qty.header,
      discount: disc.header !== "(bulunamadı)" ? disc.header : discR.header,
      name: name.header,
      date: date.header,
      group: group.header,
      type: type.header,
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    const rows: ParsedSaleRow[] = [];

    let columnMap: ColumnMap | null = null;

    if (name.endsWith(".csv")) {
      const text = buffer.toString("utf-8");
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return apiError("CSV boş veya geçersiz", "EMPTY_FILE", 400);

      const sep = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(sep).map(h => h.replace(/^"|"$/g, "").trim());

      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(sep).map(c => c.replace(/^"|"$/g, "").trim());
        if (cells.every(c => !c)) continue;
        const mapped = mapRow(headers, cells);
        if (!columnMap) columnMap = mapped.columnMap;
        rows.push(mapped.row);
      }
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
      if (data.length < 2) return apiError("Excel boş veya geçersiz", "EMPTY_FILE", 400);

      const headers = (data[0] as unknown[]).map(h => String(h));
      for (let i = 1; i < data.length; i++) {
        const row = data[i] as unknown[];
        if (row.every(c => !c)) continue;
        const mapped = mapRow(headers, row);
        if (!columnMap) columnMap = mapped.columnMap;
        rows.push(mapped.row);
      }
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
        const pageText = content.items.filter(i => "str" in i).map(i => (i as { str: string }).str).join(" ");
        lines.push(pageText);
      }
      // PDF'den basit satır bazlı parse
      const fullText = lines.join("\n");
      const textRows = fullText.split(/\n/).filter(l => l.trim().length > 5);
      for (const line of textRows.slice(1)) {
        const parts = line.trim().split(/\s{2,}|\t/);
        if (parts.length >= 3) {
          rows.push({
            productGroup: "Genel",
            productName: parts[0] ?? "Bilinmiyor",
            saleDate: parseDate(parts[1] ?? ""),
            price: parseNum(parts[2]),
            discountAmount: parseNum(parts[3]),
            saleType: parseSaleType(parts[4] ?? ""),
            quantity: 1,
          });
        }
      }
    } else {
      return apiError("Desteklenmeyen dosya formatı. CSV, Excel veya PDF yükleyin.", "INVALID_FORMAT", 400);
    }

    if (!rows.length) return apiError("Dosyadan satış verisi okunamadı", "NO_DATA", 400);

    return apiResponse({ rows, total: rows.length, columnMap });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Dosya işlenemedi";
    return apiError(msg, "PARSE_ERROR", 500);
  }
}
