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

// ÖNEMLİ: "pos", "kasa", "kart" gibi kısa/genel kelimeler yalnızca TAM başlık
// eşleşmesinde (exactOnlyAliases) denenir, bulanık (substring) eşleşmede
// KULLANILMAZ — aksi halde "Pos Z No" (POS terminalinin günlük Z-raporu sıra
// numarası, bir tutar DEĞİL) gibi bir sütun "pos" içerdiği için POS tutarı
// sanılıp yanlış (küçük, sıralı sayılardan oluşan) değerler kaydediliyordu
// (gerçek bir üretim hatasının kök nedeniydi — Satış Raporu'nda
// (`@/lib/sales/mapRow`) daha önce aynı sınıf hata için uygulanan
// `exactOnlyKeys` deseninin aynısı burada da uygulanır).
// "tarih", "havale", "eft" gibi kelimeler yeterince özgün olduğu için
// bulanık eşleşmede kalmaya devam eder (ör. "İşlem Tarihi" içindeki "tarih"
// hâlâ yakalanmalı) — yalnızca gerçekten çakışma riski taşıyan (kimlik/sıra
// numarası sütunlarıyla karışabilen) kısa/genel kelimeler exact-only'e alındı.
const DATE_ALIASES = ["tarih", "z raporu tarihi", "kasa tarihi", "date"];
const DATE_EXACT_ONLY = ["gun"];
// "Kredi" (tek başına, "Kredi Kartı" değil) bazı Z-raporu dışa aktarımlarında
// (ör. kredi kartı/POS tahsilat sütunu) kullanılan gerçek bir başlıktır —
// eklenmeden önce bu sütun HİÇBİR alana eşleşmiyor, POS tutarı sessizce 0
// kalıyor ve kredi kartı cirosunun TAMAMI kayıp gidiyordu (gerçek bir
// kullanıcı dosyasında ₺15,6M'lik bir sütunün tamamen atlandığı tespit
// edildi — bu, "pos"/"kasa"/"kart" için yapılan exact-only kısıtlamanın
// FAZLA katı kaçtığı, meşru bir sütunu da reddettiği bir durumdu).
const POS_ALIASES = ["kredi karti", "pos tutar", "pos tutari"];
const POS_EXACT_ONLY = ["pos", "kart", "kredi"];
const CASH_ALIASES = ["nakit tutar", "nakit tutari", "cash"];
const CASH_EXACT_ONLY = ["nakit", "kasa"];
const WIRE_ALIASES = ["havale", "eft", "havale eft", "havale/eft", "wire"];
const NOTES_ALIASES = ["notlar", "aciklama", "notes"];
const NOTES_EXACT_ONLY = ["not"];

function findIdx(normalized: string[], aliases: string[], exactOnlyAliases: string[] = []): number {
  // 1. geçiş: tam eşleşme (en güvenilir) — hem substring-uygun hem exact-only alias'lar denenir
  for (const alias of [...aliases, ...exactOnlyAliases]) {
    const idx = normalized.findIndex(h => h === alias);
    if (idx >= 0) return idx;
  }
  // 2. geçiş: başlık, alias ifadesini bir bütün olarak içeriyor — SADECE substring-uygun alias'lar
  for (const alias of aliases) {
    const idx = normalized.findIndex(h => h.includes(alias));
    if (idx >= 0) return idx;
  }
  return -1;
}

export function mapKasaRow(headers: string[], row: unknown[]): { row: ParsedKasaRow; colMap: KasaColumnMap } {
  const normalized = headers.map(norm);
  const dateIdx = findIdx(normalized, DATE_ALIASES, DATE_EXACT_ONLY);
  const posIdx = findIdx(normalized, POS_ALIASES, POS_EXACT_ONLY);
  const cashIdx = findIdx(normalized, CASH_ALIASES, CASH_EXACT_ONLY);
  const wireIdx = findIdx(normalized, WIRE_ALIASES);
  const notesIdx = findIdx(normalized, NOTES_ALIASES, NOTES_EXACT_ONLY);

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

/**
 * Aynı güne ait BİRDEN FAZLA satırı (işlem/fiş bazlı bir kasa kapatma
 * dışa aktarımında olduğu gibi — her satır o günün tek bir tahsilatı) tek
 * bir günlük kayda toplar: POS/Nakit/Havale tutarları TOPLANIR. Bir
 * kullanıcı talebiyle eklendi ("kasa kapatma olduğu için aynı gün
 * toplanması lazım") — önceden aynı tarihten birden fazla satır varsa
 * yalnızca ilki alınıp gerisi SESSİZCE ATLANIYORDU (bkz. `/api/v1/finans/
 * kasa/bulk`), bu da işlem bazlı dosyalarda günlük toplamların gerçekte
 * olduğundan çok düşük görünmesine yol açıyordu.
 *
 * Yalnızca `dateInvalid` olmayan (tarihi başarıyla ayrıştırılmış) satırlar
 * verilmelidir — çağıran taraf geçersiz tarihli satırları önceden filtrelemiş
 * olmalı, aksi halde hepsi aynı "geçersiz" anahtar altında toplanır.
 */
export function aggregateKasaRowsByDate(rows: ParsedKasaRow[]): ParsedKasaRow[] {
  const byDate = new Map<string, ParsedKasaRow>();
  for (const r of rows) {
    const dateKey = r.registerDate.slice(0, 10);
    const existing = byDate.get(dateKey);
    if (existing) {
      existing.posAmount += r.posAmount;
      existing.cashAmount += r.cashAmount;
      existing.wireAmount += r.wireAmount;
      if (!existing.notes && r.notes) existing.notes = r.notes;
    } else {
      byDate.set(dateKey, { ...r, registerDate: `${dateKey}T00:00:00.000Z` });
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.registerDate.localeCompare(b.registerDate));
}
