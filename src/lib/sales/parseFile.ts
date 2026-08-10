/**
 * CSV/Excel dosyalarını TARAYICIDA ayrıştırır (sunucuya yüklemeden).
 *
 * Büyük satış dosyaları (binlerce işlem satırı) sunucuya yüklendiğinde
 * platformun istek boyutu sınırına takılıp "dosya çok büyük" hatası
 * veriyordu. CSV/Excel formatları için bu artık gerekmiyor — `xlsx`
 * paketi tarayıcıda da çalıştığından ayrıştırma tamamen istemci
 * tarafında yapılıyor, ağ üzerinden hiçbir dosya gönderilmiyor.
 *
 * PDF ayrıştırması (pdfjs-dist, konum tabanlı metin çıkarımı) bu
 * modülün kapsamı dışındadır ve sunucu tarafında kalmaya devam eder.
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

/** true döner: dosya tamamen tarayıcıda ayrıştırılabilir (sunucuya yüklenmesi gerekmez). */
export function isClientParseable(fileName: string): boolean {
  const name = fileName.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");
}

export async function parseSalesFileClient(file: File): Promise<ClientParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    return parseCsvText(text);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    return parseXlsxBuffer(buffer);
  }
  throw new Error("Bu dosya türü tarayıcıda ayrıştırılamaz");
}
