import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { apiError, apiResponse } from "@/lib/utils";

export interface ParsedSgkInvoice {
  fileName: string;
  invoiceDate: string;
  invoiceType: string;
  amount: number | null;
  notes: string;
  rawText: string;
}

// SGK fatura PDF'inden tarih, tutar ve grup çıkar
function extractSgkData(text: string, fileName: string): ParsedSgkInvoice {
  const clean = text.replace(/\s+/g, " ").trim();

  // ── Tutar çıkar ────────────────────────────────────────────────
  let amount: number | null = null;
  const amountPatterns = [
    /[Tt]oplam\s*[Tt]utar[:\s]+([0-9.,]+)/,
    /[Oo]denecek\s*[Tt]utar[:\s]+([0-9.,]+)/,
    /[Ff]atura\s*[Tt]utar[ıi][:\s]+([0-9.,]+)/,
    /TOPLAM[:\s]+([0-9.,]+)/,
    /([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2}))\s*TL/,
    /([0-9.,]+)\s*₺/,
  ];
  for (const p of amountPatterns) {
    const m = clean.match(p);
    if (m) {
      const raw = m[1].replace(/\./g, "").replace(",", ".");
      const n = parseFloat(raw);
      if (!isNaN(n) && n > 0) { amount = n; break; }
    }
  }

  // ── Tarih çıkar ────────────────────────────────────────────────
  let invoiceDate = new Date().toISOString().split("T")[0];
  const datePatterns = [
    /(\d{2})[./](\d{2})[./](\d{4})/,
    /(\d{4})-(\d{2})-(\d{2})/,
  ];
  for (const p of datePatterns) {
    const m = clean.match(p);
    if (m) {
      const [, a, b, c] = m;
      if (c && c.length === 4) {
        invoiceDate = `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
      } else {
        invoiceDate = `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
      }
      break;
    }
  }

  // ── SGK grubu/türü çıkar ───────────────────────────────────────
  let invoiceType = "GROUP_A";
  const lower = clean.toLowerCase();

  if (/diyaliz/.test(lower)) invoiceType = "SEQ_DIYALIZ";
  else if (/organ\s*nakli/.test(lower)) invoiceType = "SEQ_ORGAN_NAKLI";
  else if (/onkoloji|kanser/.test(lower)) invoiceType = "SEQ_ONKOLOJI";
  else if (/psikiyatri/.test(lower)) invoiceType = "SEQ_PSIKIYATRI";
  else if (/palyatif/.test(lower)) invoiceType = "SEQ_PALYATIF";
  else if (/evde\s*sağlık|evde sag/.test(lower)) invoiceType = "SEQ_EVDE_SAGLIK";
  else if (/fizik\s*tedavi|rehabilitasyon/.test(lower)) invoiceType = "SEQ_FIZIK_TEDAVI";
  else if (/yol\s*gideri/.test(lower)) invoiceType = "SEQ_YOL_GIDERI";
  else if (/işyeri\s*hekimi|isyeri/.test(lower)) invoiceType = "SEQ_ISYERI";
  else if (/mor\s*reçete|turuncu\s*reçete/.test(lower)) invoiceType = "SEQ_MOR_TURUNCU";
  else if (/b\s*grubu|grup\s*b/.test(lower)) invoiceType = "GROUP_B";
  else if (/c\s*grubu|grup\s*c/.test(lower)) invoiceType = "GROUP_C";
  else if (/a\s*grubu|grup\s*a/.test(lower)) invoiceType = "GROUP_A";

  return {
    fileName,
    invoiceDate,
    invoiceType,
    amount,
    notes: "",
    rawText: clean.slice(0, 500),
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return apiError("Yetkisiz", "UNAUTHORIZED", 401);

  try {
    const formData = await req.formData();
    const files = formData.getAll("files");

    if (!files.length) return apiError("Dosya bulunamadı", "NO_FILE", 400);

    let pdfjs: typeof import("pdfjs-dist");
    try {
      // legacy build: Node.js'te DOMMatrix gerektirmeyen sürüm
      pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as typeof import("pdfjs-dist");
      if (pdfjs.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = "";
      }
    } catch {
      return apiError("PDF modülü yüklenemedi", "PDF_MODULE_ERROR", 500);
    }

    const results: ParsedSgkInvoice[] = [];

    for (const file of files) {
      if (typeof file === "string") continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      const uint8 = new Uint8Array(buffer);

      let text = "";
      try {
        const task = pdfjs.getDocument({ data: uint8, useWorkerFetch: false, useSystemFonts: true });
        const pdf = await task.promise;
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          text += content.items
            .filter((item) => "str" in item)
            .map((item) => (item as { str: string }).str)
            .join(" ") + " ";
        }
      } catch {
        text = "";
      }

      results.push(extractSgkData(text, file.name));
    }

    return apiResponse(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF işlenemedi";
    return apiError(message, "PARSE_ERROR", 500);
  }
}
