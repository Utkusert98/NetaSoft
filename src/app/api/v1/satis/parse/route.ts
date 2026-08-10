import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { apiError, apiResponse } from "@/lib/utils";
import {
  mapRow,
  parseSaleType,
  parseDate,
  parseNum,
  type ParsedSaleRow,
  type ColumnMap,
  type ColumnOverride,
} from "@/lib/sales/mapRow";

export type { ParsedSaleRow, ColumnMap, ColumnOverride };

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
        pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as typeof import("pdfjs-dist");
        if (pdfjs.GlobalWorkerOptions) {
          pdfjs.GlobalWorkerOptions.workerSrc = `file://${process.cwd()}/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs`;
        }
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
      // PDF metin çıkarımı konumsaldır, kolon bazlı değildir — bu yüzden kolon
      // eşleştirmesi (remap) mümkün değildir; dataRows boş döner.
      return apiResponse({ rows: pdfRows, total: pdfRows.length, columnMap: null, headers: [], dataRows: [] });

    } else {
      return apiError("Desteklenmeyen dosya formatı. CSV, Excel veya PDF yükleyin.", "INVALID_FORMAT", 400);
    }

    // Tamamen boş satırları at — istemci taraflı yeniden eşleştirmenin (remap)
    // aynı satır kümesi üzerinde çalışabilmesi için filtrelenmiş hali döndürülür.
    const nonEmptyRows = dataRows.filter(rowData => !(rowData as unknown[]).every(c => !c));

    const rows: ParsedSaleRow[] = [];
    let columnMap: ColumnMap | null = null;

    for (const rowData of nonEmptyRows) {
      const mapped = mapRow(headers, rowData as unknown[], override);
      if (!columnMap) columnMap = mapped.colMap;
      rows.push(mapped.row);
    }

    if (!rows.length) return apiError("Dosyadan satış verisi okunamadı", "NO_DATA", 400);

    return apiResponse({ rows, total: rows.length, columnMap, headers, dataRows: nonEmptyRows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Dosya işlenemedi";
    return apiError(msg, "PARSE_ERROR", 500);
  }
}
