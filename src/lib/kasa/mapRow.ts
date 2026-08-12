/**
 * Günlük Kasa (Z-raporu) toplu Excel/CSV içe aktarma için kolon eşleştirme.
 * Satış Raporu'nun (`src/lib/sales/mapRow.ts`) aynı prensiplerini izler:
 * Türkçe İ normalizasyonu, esnek başlık eşleştirmesi, asla veri uydurmama
 * (tarih ayrıştırılamazsa satır `dateInvalid` ile işaretlenir, sessizce
 * bugüne düşürülmez).
 */

import { parseDate, isParseableDate, parseNum } from "@/lib/sales/mapRow";

export interface ParsedKasaRow {
  registerDate: string; // ISO — dateInvalid ise KAYDETMEK İÇİN KULLANILMAMALI
  posAmount: number;
  cashAmount: number;
  wireAmount: number;
  notes?: string;
  rawDateValue: string;
  dateInvalid: boolean;
}

export interface KasaColumnMap {
  date: string;
  pos: string;
  cash: string;
  wire: string;
  notes: string;
}

function norm(h: string): string {
  return h.replace(/İ/g, "i").toLowerCase().trim()
    .replace(/\s+/g, " ")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");
}

const DATE_ALIASES = ["tarih", "z raporu tarihi", "kasa tarihi", "gun", "date"];
const POS_ALIASES = ["pos", "kredi karti", "kart", "pos tutar", "pos tutari"];
const CASH_ALIASES = ["nakit", "kasa", "nakit tutar", "nakit tutari", "cash"];
const WIRE_ALIASES = ["havale", "eft", "havale eft", "havale/eft", "wire"];
const NOTES_ALIASES = ["not", "notlar", "aciklama", "notes"];

function findIdx(normalized: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = normalized.findIndex(h => h === alias);
    if (idx >= 0) return idx;
  }
  for (const alias of aliases) {
    const idx = normalized.findIndex(h => h.includes(alias));
    if (idx >= 0) return idx;
  }
  return -1;
}

export function mapKasaRow(headers: string[], row: unknown[]): { row: ParsedKasaRow; colMap: KasaColumnMap } {
  const normalized = headers.map(norm);
  const dateIdx = findIdx(normalized, DATE_ALIASES);
  const posIdx = findIdx(normalized, POS_ALIASES);
  const cashIdx = findIdx(normalized, CASH_ALIASES);
  const wireIdx = findIdx(normalized, WIRE_ALIASES);
  const notesIdx = findIdx(normalized, NOTES_ALIASES);

  const gv = (idx: number): unknown => (idx >= 0 && idx < row.length ? row[idx] : undefined);

  const rawDateVal = dateIdx >= 0 ? String(gv(dateIdx) ?? "") : "";

  return {
    row: {
      registerDate: parseDate(rawDateVal),
      posAmount: parseNum(gv(posIdx)),
      cashAmount: parseNum(gv(cashIdx)),
      wireAmount: parseNum(gv(wireIdx)),
      notes: notesIdx >= 0 ? (String(gv(notesIdx) ?? "").trim() || undefined) : undefined,
      rawDateValue: rawDateVal,
      dateInvalid: !isParseableDate(rawDateVal),
    },
    colMap: {
      date: dateIdx >= 0 ? headers[dateIdx] : "—",
      pos: posIdx >= 0 ? headers[posIdx] : "—",
      cash: cashIdx >= 0 ? headers[cashIdx] : "—",
      wire: wireIdx >= 0 ? headers[wireIdx] : "—",
      notes: notesIdx >= 0 ? headers[notesIdx] : "—",
    },
  };
}
