import type { DashboardData } from "@/app/(dashboard)/panel/DashboardClient";

const PRIMARY = [78, 124, 63] as const;   // #4e7c3f
const ACCENT  = [159, 232, 112] as const; // #9fe870
const DANGER  = [231, 76, 60] as const;
const GRAY    = [120, 120, 120] as const;
const LIGHT   = [247, 248, 250] as const;
const DARK    = [30, 40, 30] as const;

type RGB = readonly [number, number, number];
type JSPDF = import("jspdf").jsPDF;

function fmtTL(v: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(v);
}

function pct(cur: number, prev: number): string {
  if (!prev) return "—";
  const p = ((cur - prev) / prev) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function setFill(doc: JSPDF, rgb: RGB) { doc.setFillColor(rgb[0], rgb[1], rgb[2]); }
function setTextColor(doc: JSPDF, rgb: RGB) { doc.setTextColor(rgb[0], rgb[1], rgb[2]); }
function setDrawColor(doc: JSPDF, rgb: RGB) { doc.setDrawColor(rgb[0], rgb[1], rgb[2]); }

function headerBand(doc: JSPDF, w: number, title: string, subtitle: string) {
  setFill(doc, DARK);
  doc.rect(0, 0, w, 28, "F");
  setTextColor(doc, ACCENT);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text("NetaSoft", 12, 17);
  setTextColor(doc, [255, 255, 255]);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(title, 12, 24);
  doc.setFontSize(8);
  doc.text(subtitle, w - 12, 24, { align: "right" });
}

function sectionTitle(doc: JSPDF, y: number, label: string, w: number): number {
  setFill(doc, PRIMARY);
  doc.roundedRect(10, y, w - 20, 9, 2, 2, "F");
  setTextColor(doc, [255, 255, 255]);
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text(label.toUpperCase(), 15, y + 6.5);
  setTextColor(doc, DARK);
  return y + 14;
}

function statBox(doc: JSPDF, x: number, y: number, w: number, h: number,
                 label: string, value: string, color: RGB) {
  setFill(doc, LIGHT);
  doc.roundedRect(x, y, w, h, 3, 3, "F");
  setDrawColor(doc, color);
  doc.setLineWidth(0.5);
  doc.line(x, y + 3, x, y + h - 3);
  setTextColor(doc, GRAY);
  doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.text(label, x + 4, y + 7);
  setTextColor(doc, color);
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text(value, x + 4, y + 16);
  setTextColor(doc, DARK);
  doc.setLineWidth(0.1);
}

function barChart(doc: JSPDF, x: number, y: number, w: number, h: number,
                  data: Array<{ label: string; value: number; color: RGB }>) {
  if (!data.length) return;
  const max = Math.max(...data.map(d => d.value), 1);
  const barW = Math.min((w - 10) / data.length - 4, 22);
  const chartH = h - 14;

  setFill(doc, LIGHT);
  doc.roundedRect(x, y, w, h, 2, 2, "F");

  data.forEach((d, i) => {
    const bx = x + 5 + i * (barW + 4);
    const bh = (d.value / max) * chartH;
    const by = y + h - 14 - bh;
    setFill(doc, d.color);
    doc.roundedRect(bx, by, barW, bh, 1, 1, "F");
    setTextColor(doc, GRAY);
    doc.setFontSize(6);
    doc.text(d.label.slice(0, 5), bx + barW / 2, y + h - 7, { align: "center" });
    setTextColor(doc, DARK);
    doc.setFontSize(6);
    doc.text(fmtTL(d.value), bx + barW / 2, by - 1, { align: "center" });
  });
  setTextColor(doc, DARK);
}

function simpleTable(doc: JSPDF, x: number, y: number, w: number,
                     headers: string[], rows: string[][], colWidths: number[]): number {
  const rowH = 8;
  // Header
  setFill(doc, PRIMARY);
  doc.rect(x, y, w, rowH, "F");
  setTextColor(doc, [255, 255, 255]);
  doc.setFontSize(7); doc.setFont("helvetica", "bold");
  let cx = x + 2;
  headers.forEach((h, i) => { doc.text(h, cx + 1, y + 5.5); cx += colWidths[i]; });

  // Rows
  rows.forEach((row, ri) => {
    const ry = y + rowH + ri * rowH;
    if (ri % 2 === 0) { setFill(doc, LIGHT); doc.rect(x, ry, w, rowH, "F"); }
    setTextColor(doc, DARK);
    doc.setFont("helvetica", "normal");
    let cx2 = x + 2;
    row.forEach((cell, ci) => {
      const text = doc.splitTextToSize(cell, colWidths[ci] - 2);
      doc.text(text[0] as string, cx2 + 1, ry + 5.5);
      cx2 += colWidths[ci];
    });
  });
  setTextColor(doc, DARK);
  return y + rowH + rows.length * rowH + 4;
}

// ── Main export function ───────────────────────────────────────────────────

export async function generateDashboardPdf(data: DashboardData, pharmacyName: string): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const now = new Date();
  const dateStr = now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const subtitle = `${pharmacyName} · ${dateStr}`;

  // ══════════════════════════════════════════════
  // SAYFA 1 — Finansal Özet
  // ══════════════════════════════════════════════
  headerBand(doc, W, "Finansal Özet Raporu", subtitle);

  let y = 36;
  y = sectionTitle(doc, y, "Bu Ay Özeti", W);

  const { summary } = data;
  const boxW = (W - 24) / 3;
  statBox(doc, 12, y, boxW, 24, "Toplam Gelir", fmtTL(summary.totalIncome), PRIMARY);
  statBox(doc, 12 + boxW + 4, y, boxW, 24, "Toplam Gider", fmtTL(summary.totalExpense), DANGER);
  statBox(doc, 12 + (boxW + 4) * 2, y, boxW, 24, "Net Kar",
    fmtTL(summary.netProfit), summary.netProfit >= 0 ? PRIMARY : DANGER);
  y += 30;

  // SGK vs Elden
  y = sectionTitle(doc, y, "SGK / Elden Satış Dağılımı", W);
  const { sgkVsCash } = data;
  const total = sgkVsCash.sgkTotal + sgkVsCash.cashTotal || 1;
  const sgkRatio = ((sgkVsCash.sgkTotal / total) * 100).toFixed(1);
  const cashRatio = ((sgkVsCash.cashTotal / total) * 100).toFixed(1);

  // Progress bar
  setFill(doc, LIGHT);
  doc.roundedRect(12, y, W - 24, 14, 2, 2, "F");
  const sgkBarW = ((sgkVsCash.sgkTotal / total) * (W - 28));
  setFill(doc, PRIMARY);
  doc.roundedRect(14, y + 2, sgkBarW, 10, 2, 2, "F");
  setTextColor(doc, [255, 255, 255]);
  doc.setFontSize(7); doc.setFont("helvetica", "bold");
  if (sgkBarW > 20) doc.text(`SGK %${sgkRatio}`, 16, y + 8);
  setTextColor(doc, PRIMARY);
  doc.text(`Elden %${cashRatio}`, W - 14, y + 8, { align: "right" });
  setTextColor(doc, DARK); y += 18;

  const hw = (W - 28) / 2;
  statBox(doc, 12, y, hw, 22, "SGK Toplam", fmtTL(sgkVsCash.sgkTotal), PRIMARY);
  statBox(doc, 12 + hw + 4, y, hw, 22, "Elden (POS/Nakit)", fmtTL(sgkVsCash.cashTotal), [52, 152, 219]);
  y += 28;

  // Aylık trend tablosu
  y = sectionTitle(doc, y, "6 Aylik Gelir / Gider / Kar Trendi", W);
  if (data.monthlyTrend.length) {
    y = simpleTable(doc, 12, y, W - 24,
      ["Ay", "Gelir", "Gider", "Kar"],
      data.monthlyTrend.map(m => [m.month, fmtTL(m.gelir), fmtTL(m.gider), fmtTL(m.kar)]),
      [35, 52, 52, 52]);
  }

  // Sezonluk ipuçları
  y = sectionTitle(doc, y, "Eczaciniz Icin Oneriler", W);
  setFill(doc, LIGHT);
  doc.roundedRect(12, y, W - 24, 52, 2, 2, "F");
  setTextColor(doc, DARK);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  const tips = buildTips(data);
  tips.forEach((tip, i) => {
    setTextColor(doc, PRIMARY);
    doc.setFont("helvetica", "bold"); doc.text("•", 16, y + 7 + i * 9);
    setTextColor(doc, DARK);
    doc.setFont("helvetica", "normal");
    doc.text(tip, 20, y + 7 + i * 9);
  });
  y += 58;

  // ══════════════════════════════════════════════
  // SAYFA 2 — Senetler + SGK Ödemeleri + Platform
  // ══════════════════════════════════════════════
  doc.addPage();
  headerBand(doc, W, "Senet & SGK & Platform Raporu", subtitle);
  y = 36;

  // Senetler
  y = sectionTitle(doc, y, "Yaklasan Senetler", W);
  const unpaid = data.promissoryNotes.filter(n => !n.isPaid);
  if (unpaid.length === 0) {
    setTextColor(doc, GRAY); doc.setFontSize(8);
    doc.text("Odenmemis senet bulunmamaktadir.", 14, y + 6);
    y += 12;
  } else {
    y = simpleTable(doc, 12, y, W - 24,
      ["Senet No", "Vade Tarihi", "Tutar", "Durum"],
      unpaid.slice(0, 12).map(n => {
        const due = new Date(n.dueDate);
        const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
        return [
          `#${n.noteNumber}`,
          due.toLocaleDateString("tr-TR"),
          fmtTL(n.amount),
          daysLeft <= 0 ? "GECIKTI!" : `${daysLeft} gun`,
        ];
      }),
      [30, 38, 52, 35]);
    const totalUnpaid = unpaid.reduce((s, n) => s + n.amount, 0);
    setTextColor(doc, DANGER);
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text(`Toplam odenmemis: ${fmtTL(totalUnpaid)}`, W - 12, y, { align: "right" });
    y += 8;
  }

  // Yaklaşan SGK
  y = sectionTitle(doc, y, "Yaklasan SGK Odemeleri (+3 Ay)", W);
  if (data.upcomingSgk.length === 0) {
    setTextColor(doc, GRAY); doc.setFontSize(8);
    doc.text("Yaklaşan SGK ödemesi bulunmamaktadır.", 14, y + 6);
    y += 12;
  } else {
    y = simpleTable(doc, 12, y, W - 24,
      ["Tur", "Tahmini Tarih", "Tutar"],
      data.upcomingSgk.map(s => [
        s.invoiceType.replace(/_/g, " "),
        new Date(s.expectedPaymentDate).toLocaleDateString("tr-TR"),
        fmtTL(s.amount),
      ]),
      [65, 42, 48]);
  }

  // Platform gelirleri
  y = sectionTitle(doc, y, "Platform Gelirleri", W);
  if (data.platformIncome.length === 0) {
    setTextColor(doc, GRAY); doc.setFontSize(8);
    doc.text("Bu ay platform geliri girilmemistir.", 14, y + 6);
    y += 12;
  } else {
    y = simpleTable(doc, 12, y, W - 24,
      ["Platform", "Tutar", "Durum"],
      data.platformIncome.map(p => [p.platformName, fmtTL(p.amount), p.status]),
      [65, 48, 42]);

    // Mini bar chart
    if (data.platformIncome.length > 1) {
      barChart(doc, 12, y, W - 24, 50,
        data.platformIncome.map((p, i) => ({
          label: p.platformName,
          value: p.amount,
          color: ([PRIMARY, [52, 152, 219], [155, 89, 182], ACCENT] as RGB[])[i % 4],
        })));
      y += 56;
    }
  }

  // ══════════════════════════════════════════════
  // SAYFA 3 — Analiz & Öneriler
  // ══════════════════════════════════════════════
  doc.addPage();
  headerBand(doc, W, "Karlılık Analizi & Eylem Plani", subtitle);
  y = 36;

  y = sectionTitle(doc, y, "Finansal Saglik Skoru", W);
  const score = calcScore(data);
  setFill(doc, LIGHT);
  doc.roundedRect(12, y, W - 24, 18, 2, 2, "F");
  setFill(doc, score.color);
  doc.roundedRect(14, y + 2, ((score.value / 100) * (W - 28)), 14, 2, 2, "F");
  setTextColor(doc, [255, 255, 255]);
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text(`${score.value}/100 — ${score.label}`, 16, y + 11);
  setTextColor(doc, DARK); y += 24;

  y = sectionTitle(doc, y, "Detayli Analiz", W);
  setFill(doc, LIGHT);
  doc.roundedRect(12, y, W - 24, 80, 2, 2, "F");
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  const analysis = buildAnalysis(data);
  analysis.forEach((line, i) => {
    const isHeading = line.startsWith("■");
    doc.setFont("helvetica", isHeading ? "bold" : "normal");
    setTextColor(doc, isHeading ? PRIMARY : DARK);
    doc.text(line, 16, y + 8 + i * 8);
  });
  y += 88;

  y = sectionTitle(doc, y, "Eylem Plani — Bu Ay Yapilmasi Gerekenler", W);
  const actions = buildActions(data);
  actions.forEach((action, i) => {
    setFill(doc, i % 2 === 0 ? LIGHT : [255, 255, 255]);
    doc.roundedRect(12, y, W - 24, 10, 1, 1, "F");
    setTextColor(doc, PRIMARY);
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}.`, 15, y + 6.5);
    setTextColor(doc, DARK);
    doc.setFont("helvetica", "normal");
    doc.text(action, 22, y + 6.5);
    y += 11;
  });

  // Footer tüm sayfalara
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setTextColor(doc, GRAY);
    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text(`NetaSoft Eczane Yönetim Sistemi · Sayfa ${i}/${pageCount} · ${dateStr}`,
      W / 2, doc.internal.pageSize.getHeight() - 6, { align: "center" });
  }

  const fileName = `netasoft-rapor-${now.toLocaleDateString("tr-TR").replace(/\./g, "-")}.pdf`;
  doc.save(fileName);
}

// ── Akıllı öneri & analiz üreteci ────────────────────────────────────────

function buildTips(data: DashboardData): string[] {
  const tips: string[] = [];
  const { summary, sgkVsCash, promissoryNotes } = data;

  if (summary.netProfit < 0)
    tips.push("Giderleriniz gelirlerinizi asiyor. Sabit giderleri gozden gecirin.");
  else if (summary.netProfit > 0)
    tips.push(`Bu ay ${fmtTL(summary.netProfit)} net kar elde edildi.`);

  const sgkRatio = sgkVsCash.sgkTotal / (sgkVsCash.sgkTotal + sgkVsCash.cashTotal || 1);
  if (sgkRatio > 0.7)
    tips.push("SGK oraniniz %70+ — platform gelirlerini artirmak dengeyi iyilestirir.");
  else if (sgkRatio < 0.4)
    tips.push("Elden satis oraniniz yuksek — SGK faturalarini sisteme eklemek gelir tahminini iyilestirir.");

  const unpaid = promissoryNotes.filter(n => !n.isPaid);
  if (unpaid.length > 0) {
    const urgent = unpaid.filter(n => Math.ceil((new Date(n.dueDate).getTime() - Date.now()) / 86400000) <= 7);
    if (urgent.length > 0)
      tips.push(`${urgent.length} senedin vadesi 7 gun icinde! Odeme planlayin.`);
    else
      tips.push(`${unpaid.length} adet odenmemis senet takipte.`);
  }

  if (data.upcomingSgk.length > 0) {
    const totalSgk = data.upcomingSgk.reduce((s, x) => s + x.amount, 0);
    tips.push(`Onumüzdeki 3 ayda ${fmtTL(totalSgk)} SGK odemesi bekleniyor.`);
  }

  if (tips.length < 3) tips.push("Envanter raporunu duzenli yuklemek karliliginizi gormenizi saglar.");
  return tips.slice(0, 5);
}

function buildAnalysis(data: DashboardData): string[] {
  const lines: string[] = [];
  const { summary, sgkVsCash, monthlyTrend } = data;
  const margin = summary.totalIncome > 0 ? (summary.netProfit / summary.totalIncome) * 100 : 0;

  lines.push("■ Kar Marji Analizi");
  lines.push(`  Kar Marji: %${margin.toFixed(1)} (Gelir: ${fmtTL(summary.totalIncome)}, Gider: ${fmtTL(summary.totalExpense)})`);
  lines.push("");

  lines.push("■ SGK Analizi");
  const total = sgkVsCash.sgkTotal + sgkVsCash.cashTotal || 1;
  lines.push(`  SGK: %${((sgkVsCash.sgkTotal / total) * 100).toFixed(0)} | Elden: %${((sgkVsCash.cashTotal / total) * 100).toFixed(0)}`);
  lines.push("");

  if (monthlyTrend.length >= 2) {
    lines.push("■ Trend Analizi (Son 2 Ay)");
    const last = monthlyTrend[monthlyTrend.length - 1];
    const prev = monthlyTrend[monthlyTrend.length - 2];
    lines.push(`  Gelir degisimi: ${pct(last.gelir, prev.gelir)} | Gider: ${pct(last.gider, prev.gider)}`);
  }

  return lines;
}

function buildActions(data: DashboardData): string[] {
  const actions: string[] = [];
  const unpaid = data.promissoryNotes.filter(n => !n.isPaid);
  const urgent = unpaid.filter(n => Math.ceil((new Date(n.dueDate).getTime() - Date.now()) / 86400000) <= 14);

  if (urgent.length > 0) actions.push(`${urgent.length} senedin odemesini planlayin (14 gun icinde).`);
  if (data.upcomingSgk.length > 0) actions.push("SGK ödeme tarihlerini takvime ekleyin.");
  if (data.platformIncome.length === 0) actions.push("Platform gelirlerinizi bu ay sisteme girin.");
  if (data.summary.netProfit < 0) actions.push("Gider kalemlerini gozden gecirin, tasarruf alanlari belirleyin.");
  actions.push("Aylik envanter raporunu yukleyin — karlılık analizini gunceller.");
  actions.push("SGK faturalarinizi PDF olarak yukleyin, sistem otomatik okur.");
  return actions.slice(0, 7);
}

function calcScore(data: DashboardData): { value: number; label: string; color: RGB } {
  let score = 50;
  const { summary } = data;
  if (summary.netProfit > 0) score += 20;
  if (summary.netProfit > summary.totalIncome * 0.2) score += 10;
  const unpaid = data.promissoryNotes.filter(n => !n.isPaid);
  if (unpaid.length === 0) score += 10;
  if (data.platformIncome.length > 0) score += 5;
  if (data.upcomingSgk.length > 0) score += 5;
  score = Math.min(100, Math.max(10, score));

  if (score >= 75) return { value: score, label: "Iyi", color: PRIMARY };
  if (score >= 50) return { value: score, label: "Orta", color: [245, 166, 35] };
  return { value: score, label: "Dikkat Gerekiyor", color: DANGER };
}
