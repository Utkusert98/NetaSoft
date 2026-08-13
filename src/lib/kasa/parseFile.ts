/**
 * Günlük Kasa (Z-raporu) CSV/Excel dosyalarını TARAYICIDA ayrıştırır (sunucuya
 * yüklemeden) — Satış Raporu'nda (`@/lib/sales/parseFile`) aynı gerekçeyle
 * uygulanan desenin aynısı: büyük/çok aylık kasa dosyaları sunucuya
 * yüklendiğinde platformun istek boyutu sınırına (Vercel serverless
 * fonksiyonlarında ~4.5MB) takılıp önce "Sunucu hatası, lütfen tekrar
 * deneyin" (yerelde asla görünmeyen, sadece üretimde ortaya çıkan bir hata)
 * veriyordu. `xlsx` paketi tarayıcıda da çalıştığından ayrıştırma tamamen
 * istemci tarafında yapılır, ağ üzerinden hiçbir dosya gönderilmez.
 */

export interface ClientParsedFile {
  headers: string[];
  dataRows: unknown[][];
}

function parseCsvText(text: string): ClientParsedFile {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV boş veya geçersiz");
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.replace(/^"|"$/g, "").trim());
  const dataRows = lines.slice(1).map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim()));
  return { headers, dataRows };
}

async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<ClientParsedFile> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
  if (data.length < 2) throw new Error("Excel boş veya geçersiz");
  const headers = (data[0] as unknown[]).map((h) => String(h));
  const dataRows = data.slice(1) as unknown[][];
  return { headers, dataRows };
}

export function isClientParseableKasaFile(fileName: string): boolean {
  const name = fileName.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");
}

export async function parseKasaFileClient(file: File): Promise<ClientParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    return parseCsvText(text);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    return parseXlsxBuffer(buffer);
  }
  throw new Error("Desteklenmeyen dosya formatı. CSV veya Excel yükleyin.");
}
