import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth/auth";
import { apiResponse, apiError } from "@/lib/utils";

interface ParsedRow {
  rowIndex: number;
  rawData: Record<string, unknown>;
  isValid: boolean;
  errors?: string[];
}

interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  errorRows: number;
}

function parseSpreadsheet(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    dateNF: "DD/MM/YYYY",
  });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (raw.length < 2) {
    throw new Error("Dosya boş veya yalnızca başlık satırı içeriyor");
  }

  const headerRow = raw[0] as unknown[];
  const headers = headerRow.map((h) => String(h ?? "").trim()).filter(Boolean);

  if (headers.length === 0) {
    throw new Error("Sütun başlıkları bulunamadı");
  }

  const dataRows = raw.slice(1);

  const rows: ParsedRow[] = [];
  dataRows.forEach((rowArr, i) => {
    const cells = rowArr as unknown[];
    const rawData: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      const val = cells[j];
      rawData[h] = val instanceof Date ? val.toLocaleDateString("tr-TR") : val ?? "";
    });

    const hasContent = Object.values(rawData).some((v) => String(v).trim() !== "");
    if (!hasContent) return;

    const errors: string[] = [];

    rows.push({
      rowIndex: i,
      rawData,
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    });
  });

  const validRows = rows.filter((r) => r.isValid).length;
  return {
    headers,
    rows,
    totalRows: rows.length,
    validRows,
    errorRows: rows.length - validRows,
  };
}

async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  let pdfjs: typeof import("pdfjs-dist");
  try {
    pdfjs = await import("pdfjs-dist");
  } catch {
    throw new Error("PDF işleme modülü yüklenemedi. Lütfen CSV veya Excel formatında yükleyin.");
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;

  type YGroup = Map<number, Array<{ x: number; text: string }>>;
  const pageLines: string[][] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    const yGroups: YGroup = new Map();
    content.items.forEach((item) => {
      if (!("str" in item) || !item.str.trim()) return;
      const y = Math.round((item as { transform: number[] }).transform[5]);
      if (!yGroups.has(y)) yGroups.set(y, []);
      const x = (item as { transform: number[] }).transform[4];
      yGroups.get(y)!.push({ x, text: item.str });
    });

    Array.from(yGroups.entries())
      .sort(([a], [b]) => b - a)
      .forEach(([, items]) => {
        const sorted = items.sort((a, b) => a.x - b.x);
        pageLines.push(sorted.map((i) => i.text));
      });
  }

  if (pageLines.length < 2) {
    throw new Error("PDF'den tablo verisi okunamadı. Lütfen CSV veya Excel formatında yükleyin.");
  }

  const headers = pageLines[0].map((h) => h.trim()).filter(Boolean);
  const rows: ParsedRow[] = pageLines.slice(1).map((cells, i) => {
    const rawData: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      rawData[h] = cells[j]?.trim() ?? "";
    });
    const hasContent = Object.values(rawData).some((v) => String(v).trim() !== "");
    return { rowIndex: i, rawData, isValid: hasContent };
  }).filter((r) => r.isValid);

  return {
    headers,
    rows,
    totalRows: rows.length,
    validRows: rows.length,
    errorRows: 0,
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return apiError("Yetkisiz", "UNAUTHORIZED", 401);

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return apiError("Dosya bulunamadı", "NO_FILE", 400);
    }

    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let result: ParseResult;

    if (name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls")) {
      result = parseSpreadsheet(buffer);
    } else if (name.endsWith(".pdf")) {
      result = await parsePdf(buffer);
    } else {
      return apiError(
        "Desteklenmeyen format. CSV, Excel (.xlsx/.xls) veya PDF yükleyin.",
        "UNSUPPORTED_FORMAT",
        400,
      );
    }

    if (result.totalRows === 0) {
      return apiError("Dosya boş veya okunamadı", "EMPTY_FILE", 400);
    }

    return apiResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dosya işlenemedi";
    return apiError(message, "PARSE_ERROR", 500);
  }
}
