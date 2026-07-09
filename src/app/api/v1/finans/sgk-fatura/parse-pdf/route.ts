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
  // PDF'ten okunan ek bilgiler (onay ekranında gösterilir, DB'ye kaydedilmez)
  invoiceNo?: string;
  periodStart?: string;
  periodEnd?: string;
  eczaneName?: string;
}

// SGK fatura PDF'inden tarih, tutar ve grup çıkar
function extractSgkData(text: string, fileName: string): ParsedSgkInvoice {
  const clean = text.replace(/\s+/g, " ").trim();
  const lower = clean.toLowerCase();

  // ── Fatura No çıkar ───────────────────────────────────────────
  let invoiceNo: string | undefined;
  const invNoMatch = clean.match(/[Ff]atura\s+No\s*[:\s]*([A-Z0-9]+)/);
  if (invNoMatch) invoiceNo = invNoMatch[1];

  // ── Eczane adı çıkar — "ECZANESİ" kelimesine kadar olan isim bloğunu al
  let eczaneName: string | undefined;
  // "X ECZANESİ" kalıbını tüm metinde ara
  const eczaneFullMatch = clean.match(/([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğışöü\s]{2,40})\s+ECZANESİ/i);
  if (eczaneFullMatch) {
    eczaneName = (eczaneFullMatch[1].trim() + " Eczanesi").replace(/\s+/g, " ");
  } else {
    const eczaneMatch = clean.match(/Mükellef\s+Adı\s*[:\s]+(\S+)/i);
    if (eczaneMatch) eczaneName = eczaneMatch[1].trim();
  }

  // ── Dönem çıkar ────────────────────────────────────────────────
  let periodStart: string | undefined;
  let periodEnd: string | undefined;
  const periodStartMatch = clean.match(/[Dd]önem\s+[Bb]aşlangıcı\s*[:\s]*(\d{2}[-./]\d{2}[-./]\d{4})/);
  const periodEndMatch   = clean.match(/[Dd]önem\s+[Bb]itişi\s*[:\s]*(\d{2}[-./]\d{2}[-./]\d{4})/);
  if (periodStartMatch) periodStart = normDate(periodStartMatch[1]);
  if (periodEndMatch)   periodEnd   = normDate(periodEndMatch[1]);

  // ── Tutar çıkar — önce "Toplam Ödenecek Tutar" dene ──────────
  let amount: number | null = null;
  const amountPatterns = [
    /[Tt]oplam\s+[Öo]denecek\s+[Tt]utar[:\s]*([0-9.,]+)/,   // Toplam Ödenecek Tutar (boşluksuz da çalışır)
    /[Ff]atura\s+[Tt]utar[ıi][:\s]*([0-9.,]+)/,              // Fatura Tutarı
    /TOPLAM\s+[Öo]denecek\s+[Tt]utar[:\s]*([0-9.,]+)/i,
  ];
  for (const p of amountPatterns) {
    const m = clean.match(p);
    if (m) {
      const raw = m[1].replace(/\./g, "").replace(",", ".");
      const n = parseFloat(raw);
      if (!isNaN(n) && n > 0) { amount = n; break; }
    }
  }

  // ── Fatura tarihi çıkar (Fatura Tarihi öncelikli) ─────────────
  let invoiceDate = new Date().toISOString().split("T")[0];
  const fatTarihMatch = clean.match(/[Ff]atura\s+[Tt]arihi\s*[:\s]*(\d{2}[-./]\d{2}[-./]\d{4})/);
  if (fatTarihMatch) {
    invoiceDate = normDate(fatTarihMatch[1]);
  } else {
    const m = clean.match(/(\d{2})[-./](\d{2})[-./](\d{4})/);
    if (m) invoiceDate = `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  }

  // ── SGK grubu/türü çıkar ───────────────────────────────────────
  let invoiceType = "GROUP_A";
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
    rawText: clean.slice(0, 600),
    invoiceNo,
    periodStart,
    periodEnd,
    eczaneName,
  };
}

// "30-04-2026" → "2026-04-30"
function normDate(raw: string): string {
  const m = raw.match(/(\d{2})[-./](\d{2})[-./](\d{4})/);
  if (!m) return raw;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return apiError("Yetkisiz", "UNAUTHORIZED", 401);

  try {
    const formData = await req.formData();
    const files = formData.getAll("files");

    if (!files.length) return apiError("Dosya bulunamadı", "NO_FILE", 400);

    type PdfParseResult = { text: string; numpages: number };
    type PdfParseFn = (buf: Buffer) => Promise<PdfParseResult>;
    let pdfParse: PdfParseFn;
    try {
      const mod = await import("pdf-parse");
      // pdf-parse v1.x exports a function as default
      pdfParse = (mod.default ?? mod) as unknown as PdfParseFn;
    } catch {
      return apiError("PDF modülü yüklenemedi", "PDF_MODULE_ERROR", 500);
    }

    const results: ParsedSgkInvoice[] = [];

    for (const file of files) {
      if (typeof file === "string") continue;
      const buffer = Buffer.from(await file.arrayBuffer());

      let text = "";
      try {
        const data = await pdfParse(buffer);
        text = data.text;
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
