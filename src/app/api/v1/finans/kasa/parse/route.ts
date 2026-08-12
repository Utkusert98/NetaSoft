import { auth } from "@/lib/auth/auth";
import { apiError, apiResponse } from "@/lib/utils";
import { mapKasaRow, type ParsedKasaRow, type KasaColumnMap } from "@/lib/kasa/mapRow";

export type { ParsedKasaRow, KasaColumnMap };

// POST /api/v1/finans/kasa/parse — Günlük Kasa (Z-raporu) toplu yükleme için
// Excel/CSV dosyasını ayrıştırır. Satış Raporu'nun parse akışıyla (bkz.
// /api/v1/satis/parse) aynı deseni izler: dosya sadece ayrıştırılır, veritabanına
// yazılmaz — onay ekranından geçtikten sonra /api/v1/finans/kasa/bulk çağrılır.
export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return apiError("Yetkisiz", "UNAUTHORIZED", 401);

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") return apiError("Dosya bulunamadı", "NO_FILE", 400);

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
    } else {
      return apiError("Desteklenmeyen dosya formatı. CSV veya Excel yükleyin.", "INVALID_FORMAT", 400);
    }

    const nonEmptyRows = dataRows.filter(rowData => !(rowData as unknown[]).every(c => !c));
    if (!nonEmptyRows.length) return apiError("Dosyadan kasa verisi okunamadı", "NO_DATA", 400);

    const rows: ParsedKasaRow[] = [];
    let columnMap: KasaColumnMap | null = null;
    for (const rowData of nonEmptyRows) {
      const mapped = mapKasaRow(headers, rowData as unknown[]);
      if (!columnMap) columnMap = mapped.colMap;
      rows.push(mapped.row);
    }

    return apiResponse({ rows, total: rows.length, columnMap, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Dosya işlenemedi";
    return apiError(msg, "PARSE_ERROR", 500);
  }
}
