import type { DashboardData } from "@/app/(dashboard)/panel/DashboardClient";

/**
 * PDF raporu artık jsPDF'in yerleşik "helvetica" fontuyla değil, gerçek bir
 * HTML/CSS şablonunu tarayıcıda render edip (html2canvas) görüntü olarak
 * PDF'e gömerek üretiliyor. Bunun tek nedeni jsPDF'in standart fontlarının
 * WinAnsi kodlamasını kullanması — bu kodlamada ç/ö/ü var ama Türkçe'ye özgü
 * ı, İ, ş, Ş, ğ, Ğ karakterleri YOK. Eski üretici bu yüzden "harfler sayılar
 * çok kötü" görünüyordu (Türkçe karakterler kayboluyor/bozuluyordu) ve manuel
 * y-koordinat hesapları sayfa taşmalarına yol açıyordu. Tarayıcı üzerinden
 * render etmek Türkçe karakterleri doğru gösterir ve CSS akışı taşma riskini
 * ortadan kaldırır.
 */

const COLORS = {
  primary: "#4e7c3f",
  primaryDark: "#163300",
  accent: "#9fe870",
  danger: "#e74c3c",
  blue: "#3498db",
  purple: "#9b59b6",
  text: "#1e2a1e",
  muted: "#6b7a6b",
  bg: "#f7f8fa",
  border: "#e2e6e2",
} as const;

function fmtTL(v: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(v);
}

function pctChange(cur: number, prev: number): string {
  if (!prev) return "—";
  const p = ((cur - prev) / prev) * 100;
  return `${p >= 0 ? "▲ +" : "▼ "}${p.toFixed(1)}%`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Küçük HTML bileşenleri ───────────────────────────────────────────────

function statCard(label: string, value: string, color: string, sub?: string): string {
  return `
    <div style="flex:1;background:${COLORS.bg};border-radius:10px;padding:14px 16px;border-left:4px solid ${color};min-width:0;">
      <div style="font-size:11px;color:${COLORS.muted};font-weight:600;margin-bottom:4px;">${esc(label)}</div>
      <div style="font-size:20px;font-weight:800;color:${color};line-height:1.2;">${esc(value)}</div>
      ${sub ? `<div style="font-size:10px;color:${COLORS.muted};margin-top:3px;">${esc(sub)}</div>` : ""}
    </div>`;
}

function sectionTitle(label: string): string {
  return `
    <div style="background:linear-gradient(135deg,${COLORS.primary},${COLORS.primaryDark});color:white;
                border-radius:8px;padding:9px 14px;font-size:12px;font-weight:700;letter-spacing:0.03em;
                text-transform:uppercase;margin:20px 0 12px;">
      ${esc(label)}
    </div>`;
}

function horizontalBar(label: string, value: number, max: number, color: string, valueLabel: string): string {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return `
    <div style="margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">
        <span style="color:${COLORS.text};font-weight:600;">${esc(label)}</span>
        <span style="color:${COLORS.muted};">${esc(valueLabel)}</span>
      </div>
      <div style="background:${COLORS.border};border-radius:5px;height:9px;overflow:hidden;">
        <div style="background:${color};width:${pct}%;height:100%;border-radius:5px;"></div>
      </div>
    </div>`;
}

function dataTable(headers: string[], rows: string[][], widths: number[]): string {
  const total = widths.reduce((a, b) => a + b, 0);
  const colgroup = widths.map(w => `<col style="width:${(w / total) * 100}%;">`).join("");
  const thead = headers.map(h => `<th style="text-align:left;padding:7px 10px;font-size:10px;">${esc(h)}</th>`).join("");
  const tbody = rows.map((row, i) => `
    <tr style="background:${i % 2 === 0 ? COLORS.bg : "transparent"};">
      ${row.map(cell => `<td style="padding:7px 10px;font-size:11px;color:${COLORS.text};">${esc(cell)}</td>`).join("")}
    </tr>`).join("");
  return `
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;">
      <colgroup>${colgroup}</colgroup>
      <thead><tr style="background:${COLORS.primary};color:white;">${thead}</tr></thead>
      <tbody>${tbody}</tbody>
    </table>`;
}

function emptyState(message: string): string {
  return `<p style="color:${COLORS.muted};font-size:11px;padding:10px 4px;">${esc(message)}</p>`;
}

// ── Sayfa şablonları ──────────────────────────────────────────────────────

function pageShell(headerTitle: string, subtitle: string, bodyHtml: string, pageLabel: string): string {
  return `
    <section style="width:210mm;min-height:297mm;background:white;font-family:'Segoe UI',Arial,sans-serif;
                     color:${COLORS.text};box-sizing:border-box;display:flex;flex-direction:column;
                     page-break-after:always;">
      <header style="background:linear-gradient(135deg,${COLORS.primaryDark},#0f2400);color:white;
                      padding:16px 24px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:20px;font-weight:800;color:${COLORS.accent};">NetaSoft</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.85);margin-top:2px;">${esc(headerTitle)}</div>
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,0.7);text-align:right;">${esc(subtitle)}</div>
      </header>
      <div style="padding:20px 24px;flex:1;">
        ${bodyHtml}
      </div>
      <footer style="padding:8px 24px;font-size:9px;color:${COLORS.muted};text-align:center;border-top:1px solid ${COLORS.border};">
        NetaSoft Eczane Yönetim Sistemi · ${esc(pageLabel)}
      </footer>
    </section>`;
}

function buildPage1(data: DashboardData, subtitle: string): string {
  const { summary, sgkVsCash } = data;
  const total = sgkVsCash.sgkTotal + sgkVsCash.cashTotal || 1;
  const sgkRatio = (sgkVsCash.sgkTotal / total) * 100;
  const cashRatio = 100 - sgkRatio;

  const trendRows = data.monthlyTrend.slice(-6).map(m => [m.month, fmtTL(m.gelir), fmtTL(m.gider), fmtTL(m.kar)]);
  const maxTrend = Math.max(...data.monthlyTrend.map(m => Math.max(m.gelir, m.gider)), 1);

  const body = `
    ${sectionTitle("Bu Ay Özeti")}
    <div style="display:flex;gap:10px;">
      ${statCard("Toplam Gelir", fmtTL(summary.totalIncome), COLORS.primary, pctChange(summary.totalIncome, summary.totalIncome / (1 + summary.incomeChange / 100)) + " geçen aya göre")}
      ${statCard("Toplam Gider", fmtTL(summary.totalExpense), COLORS.danger)}
      ${statCard("Net Kâr", fmtTL(summary.netProfit), summary.netProfit >= 0 ? COLORS.primary : COLORS.danger)}
    </div>

    ${sectionTitle("SGK / Elden Satış Dağılımı")}
    <div style="background:${COLORS.bg};border-radius:8px;padding:12px 16px;">
      <div style="display:flex;height:16px;border-radius:8px;overflow:hidden;margin-bottom:10px;">
        <div style="width:${sgkRatio}%;background:${COLORS.primary};display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:700;">${sgkRatio > 12 ? `SGK %${sgkRatio.toFixed(0)}` : ""}</div>
        <div style="width:${cashRatio}%;background:${COLORS.blue};display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:700;">${cashRatio > 12 ? `Elden %${cashRatio.toFixed(0)}` : ""}</div>
      </div>
      <div style="display:flex;gap:20px;font-size:11px;">
        <span><span style="display:inline-block;width:9px;height:9px;background:${COLORS.primary};border-radius:2px;margin-right:5px;"></span>SGK: ${fmtTL(sgkVsCash.sgkTotal)}</span>
        <span><span style="display:inline-block;width:9px;height:9px;background:${COLORS.blue};border-radius:2px;margin-right:5px;"></span>Elden (POS/Nakit): ${fmtTL(sgkVsCash.cashTotal)}</span>
      </div>
    </div>

    ${sectionTitle("Son 6 Ay Gelir / Gider / Kâr Trendi")}
    ${data.monthlyTrend.length
      ? `<div style="margin-bottom:10px;">
          ${data.monthlyTrend.slice(-6).map(m => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <div style="width:36px;font-size:10px;color:${COLORS.muted};">${esc(m.month)}</div>
              <div style="flex:1;display:flex;gap:2px;height:12px;">
                <div style="width:${Math.max(1, (m.gelir / maxTrend) * 100)}%;background:${COLORS.primary};border-radius:2px;"></div>
              </div>
              <div style="width:70px;font-size:10px;text-align:right;color:${COLORS.text};">${fmtTL(m.gelir)}</div>
            </div>`).join("")}
        </div>
        ${dataTable(["Ay", "Gelir", "Gider", "Kâr"], trendRows, [20, 27, 27, 26])}`
      : emptyState("Henüz aylık trend verisi yok.")}

    ${sectionTitle("Eczacınız İçin Öneriler")}
    <div style="background:${COLORS.bg};border-radius:8px;padding:14px 16px;">
      ${buildTips(data).map(tip => `
        <div style="display:flex;gap:8px;margin-bottom:8px;font-size:11px;line-height:1.5;">
          <span style="color:${COLORS.primary};font-weight:800;">•</span>
          <span>${esc(tip)}</span>
        </div>`).join("")}
    </div>
  `;
  return pageShell("Finansal Özet Raporu", subtitle, body, "Sayfa 1/4 — Finansal Özet");
}

function buildPage2(data: DashboardData, subtitle: string): string {
  const unpaid = data.promissoryNotes.filter(n => !n.isPaid);
  const totalUnpaid = unpaid.reduce((s, n) => s + n.amount, 0);

  const notesSection = unpaid.length === 0
    ? emptyState("Ödenmemiş senet bulunmamaktadır.")
    : `${dataTable(
        ["Senet No", "Vade Tarihi", "Tutar", "Durum"],
        unpaid.slice(0, 12).map(n => {
          const due = new Date(n.dueDate);
          const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
          return [`#${n.noteNumber}`, due.toLocaleDateString("tr-TR"), fmtTL(n.amount), daysLeft <= 0 ? "Gecikti!" : `${daysLeft} gün kaldı`];
        }),
        [22, 26, 26, 26],
      )}
      <div style="text-align:right;font-size:12px;font-weight:700;color:${COLORS.danger};margin-top:8px;">
        Toplam ödenmemiş: ${fmtTL(totalUnpaid)}
      </div>`;

  const sgkSection = data.upcomingSgk.length === 0
    ? emptyState("Yaklaşan SGK ödemesi bulunmamaktadır.")
    : dataTable(
        ["Tür", "Tahmini Tarih", "Tutar"],
        data.upcomingSgk.map(s => [s.invoiceType.replace(/_/g, " "), new Date(s.expectedPaymentDate).toLocaleDateString("tr-TR"), fmtTL(s.amount)]),
        [40, 30, 30],
      );

  const maxPlatform = Math.max(...data.platformIncome.map(p => p.amount), 1);
  const platformSection = data.platformIncome.length === 0
    ? emptyState("Bu ay platform geliri girilmemiştir.")
    : `${dataTable(["Platform", "Tutar", "Durum"], data.platformIncome.map(p => [p.platformName, fmtTL(p.amount), p.status]), [40, 30, 30])}
       <div style="margin-top:12px;">
        ${data.platformIncome.map((p, i) => horizontalBar(
          p.platformName, p.amount, maxPlatform,
          [COLORS.primary, COLORS.blue, COLORS.purple, COLORS.accent][i % 4],
          fmtTL(p.amount),
        )).join("")}
       </div>`;

  const body = `
    ${sectionTitle("Yaklaşan Senetler")}
    ${notesSection}
    ${sectionTitle("Yaklaşan SGK Ödemeleri (+3 Ay)")}
    ${sgkSection}
    ${sectionTitle("Platform Gelirleri")}
    ${platformSection}
  `;
  return pageShell("Senet & SGK & Platform Raporu", subtitle, body, "Sayfa 2/4 — Ödemeler");
}

function buildPage3(data: DashboardData, subtitle: string): string {
  const score = calcScore(data);
  const analysis = buildAnalysis(data);
  const actions = buildActions(data);

  const body = `
    ${sectionTitle("Finansal Sağlık Skoru")}
    <div style="background:${COLORS.bg};border-radius:8px;padding:4px;margin-bottom:6px;">
      <div style="background:${COLORS.border};border-radius:8px;height:22px;overflow:hidden;">
        <div style="width:${score.value}%;background:${score.color};height:100%;display:flex;align-items:center;padding-left:10px;color:white;font-size:11px;font-weight:700;">
          ${score.value}/100 — ${score.label}
        </div>
      </div>
    </div>

    ${sectionTitle("Detaylı Analiz")}
    <div style="background:${COLORS.bg};border-radius:8px;padding:14px 16px;">
      ${analysis.map(section => `
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:${COLORS.primary};margin-bottom:4px;">${esc(section.heading)}</div>
          ${section.lines.map(l => `<div style="font-size:11px;color:${COLORS.text};line-height:1.5;">${esc(l)}</div>`).join("")}
        </div>`).join("")}
    </div>

    ${sectionTitle("Eylem Planı — Bu Ay Yapılması Gerekenler")}
    <div>
      ${actions.map((action, i) => `
        <div style="display:flex;gap:10px;align-items:flex-start;padding:9px 12px;background:${i % 2 === 0 ? COLORS.bg : "transparent"};border-radius:6px;margin-bottom:2px;">
          <span style="color:${COLORS.primary};font-weight:800;font-size:11px;flex-shrink:0;">${i + 1}.</span>
          <span style="font-size:11px;color:${COLORS.text};line-height:1.4;">${esc(action)}</span>
        </div>`).join("")}
    </div>
  `;
  return pageShell("Kârlılık Analizi & Eylem Planı", subtitle, body, "Sayfa 3/4 — Analiz");
}

// ── Satış Raporu & Envanter Özeti (Sayfa 4) ──────────────────────────────────
// Dashboard'a sonradan eklenen "Bu Ayın En Çok Satan Ürünleri", "Reçeteli/
// Perakende Dağılımı" ve "Son Envanter Özeti" kartları PDF raporuna hiç
// yansımıyordu — kullanıcı geri bildirimiyle tespit edildi ("yeni bölümler
// yeni grafikler geldi, PDF'i güncelleyelim"). Bu veriler `DashboardData`
// içinde yer almaz (kartlar kendi verisini bağımsız çeker), bu yüzden PDF
// üretilirken burada AYRICA çekilir. SADECE bilgilendirme amaçlıdır — diğer
// sayfalardaki resmi Toplam Gelir/Net Kâr rakamlarını beslemez (uygulama
// genelindeki aynı kural, bkz. PrescriptionRetailSplit/DashboardInsightCards).
interface SatisSummaryLite { prescriptionRevenue: number; retailRevenue: number; totalRecords: number }
interface SatisRecordLite { productName: string; netRevenue: number; quantity: number }
interface InventoryReportLite {
  fileName: string;
  totalStockValue: number | string;
  totalStockCost: number | string;
  potentialMargin: number | string;
  createdAt: string;
}

async function fetchSatisAndEnvanterForPdf(): Promise<{
  satisSummary: SatisSummaryLite | null;
  topProducts: Array<{ productName: string; revenue: number; quantity: number }>;
  inventory: InventoryReportLite | null;
}> {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const [satisRes, invRes] = await Promise.all([
    fetch(`/api/v1/satis?${new URLSearchParams({ start, end })}`).catch(() => null),
    fetch("/api/v1/stok/envanter-raporu").catch(() => null),
  ]);

  let satisSummary: SatisSummaryLite | null = null;
  let topProducts: Array<{ productName: string; revenue: number; quantity: number }> = [];
  if (satisRes?.ok) {
    const json = await satisRes.json().catch(() => null) as {
      success: boolean;
      data?: { summary: SatisSummaryLite; records: SatisRecordLite[] };
    } | null;
    if (json?.success && json.data) {
      satisSummary = json.data.summary;
      const { topProductsByRevenue } = await import("@/lib/sales/aggregations");
      topProducts = topProductsByRevenue(json.data.records, 5);
    }
  }

  let inventory: InventoryReportLite | null = null;
  if (invRes?.ok) {
    const json = await invRes.json().catch(() => null) as { success: boolean; data?: InventoryReportLite[] } | null;
    if (json?.success && json.data && json.data.length > 0) inventory = json.data[0];
  }

  return { satisSummary, topProducts, inventory };
}

function buildPage4(
  satisSummary: SatisSummaryLite | null,
  topProducts: Array<{ productName: string; revenue: number; quantity: number }>,
  inventory: InventoryReportLite | null,
  subtitle: string,
): string {
  const totalSatis = satisSummary ? satisSummary.prescriptionRevenue + satisSummary.retailRevenue : 0;
  const rxPct = totalSatis > 0 && satisSummary ? (satisSummary.prescriptionRevenue / totalSatis) * 100 : 0;
  const retailPct = 100 - rxPct;

  const satisSection = !satisSummary || totalSatis <= 0
    ? emptyState("Bu ay için Satış Raporu verisi yüklenmemiş.")
    : `
      <div style="background:${COLORS.bg};border-radius:8px;padding:12px 16px;margin-bottom:14px;">
        <div style="display:flex;height:16px;border-radius:8px;overflow:hidden;margin-bottom:10px;">
          <div style="width:${rxPct}%;background:${COLORS.primary};display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:700;">${rxPct > 12 ? `Reçeteli %${rxPct.toFixed(0)}` : ""}</div>
          <div style="width:${retailPct}%;background:${COLORS.blue};display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:700;">${retailPct > 12 ? `Perakende %${retailPct.toFixed(0)}` : ""}</div>
        </div>
        <div style="display:flex;gap:20px;font-size:11px;">
          <span><span style="display:inline-block;width:9px;height:9px;background:${COLORS.primary};border-radius:2px;margin-right:5px;"></span>Reçeteli: ${fmtTL(satisSummary.prescriptionRevenue)}</span>
          <span><span style="display:inline-block;width:9px;height:9px;background:${COLORS.blue};border-radius:2px;margin-right:5px;"></span>Perakende: ${fmtTL(satisSummary.retailRevenue)}</span>
        </div>
      </div>
      <div style="font-size:10px;color:${COLORS.muted};margin-bottom:14px;">
        ℹ️ Sadece bilgilendirme amaçlıdır, Satış Raporu'ndan kaynaklanır. Bu sayfadaki hiçbir resmi toplamı (Kasa, Toplam Gelir, SGK Fatura) beslemez.
      </div>`;

  const maxProductRevenue = topProducts.length > 0 ? topProducts[0].revenue : 0;
  const topProductsSection = topProducts.length === 0
    ? emptyState("Bu ay için Satış Raporu verisi yüklenmemiş.")
    : topProducts.map((p, i) => horizontalBar(
        `${i + 1}. ${p.productName}`, p.revenue, maxProductRevenue,
        [COLORS.primary, COLORS.blue, COLORS.purple, COLORS.accent, "#f5a623"][i % 5],
        fmtTL(p.revenue),
      )).join("");

  const inventorySection = !inventory
    ? emptyState("Henüz yüklenmiş bir Envanter Raporu yok.")
    : `
      <div style="display:flex;gap:10px;margin-bottom:8px;">
        ${statCard("Toplam Stok Değeri", fmtTL(Number(inventory.totalStockValue)), COLORS.primary)}
        ${statCard("Potansiyel Kâr Marjı", `%${Number(inventory.potentialMargin).toFixed(1)}`, Number(inventory.potentialMargin) >= 0 ? COLORS.primary : COLORS.danger)}
      </div>
      <div style="font-size:10px;color:${COLORS.muted};">
        📄 ${esc(inventory.fileName)} · Son yüklenen envanter raporuna göre (${new Date(inventory.createdAt).toLocaleDateString("tr-TR")})
      </div>`;

  const body = `
    ${sectionTitle("Satış Raporu: Reçeteli / Perakende Dağılımı (Bu Ay)")}
    ${satisSection}

    ${sectionTitle("Bu Ayın En Çok Satan Ürünleri")}
    ${topProductsSection}

    ${sectionTitle("Son Envanter Özeti")}
    ${inventorySection}
  `;
  return pageShell("Satış Raporu & Envanter Özeti", subtitle, body, "Sayfa 4/4 — Satış & Envanter");
}

// ── Ana dışa aktarım fonksiyonu ─────────────────────────────────────────────

export async function generateDashboardPdf(data: DashboardData, pharmacyName: string): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }, pdfExtras] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
    fetchSatisAndEnvanterForPdf(),
  ]);

  const now = new Date();
  const dateStr = now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const subtitle = `${pharmacyName} · ${dateStr}`;

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "-99999px";
  wrapper.style.zIndex = "-1";
  wrapper.innerHTML = buildPage1(data, subtitle) + buildPage2(data, subtitle) + buildPage3(data, subtitle)
    + buildPage4(pdfExtras.satisSummary, pdfExtras.topProducts, pdfExtras.inventory, subtitle);
  document.body.appendChild(wrapper);

  try {
    const pageSections = Array.from(wrapper.children) as HTMLElement[];
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidthMm = doc.internal.pageSize.getWidth();
    const pageHeightMm = doc.internal.pageSize.getHeight();

    for (let i = 0; i < pageSections.length; i++) {
      const canvas = await html2canvas(pageSections[i], {
        scale: 2.5,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      // Canvas oranını koru, A4 sayfasına tam otur (gerekirse hafif küçült,
      // asla sayfa dışına taşırma).
      const imgHeightMm = Math.min(pageHeightMm, (canvas.height / canvas.width) * pageWidthMm);
      if (i > 0) doc.addPage();
      doc.addImage(imgData, "PNG", 0, 0, pageWidthMm, imgHeightMm);
    }

    const fileName = `netasoft-rapor-${now.toLocaleDateString("tr-TR").replace(/\./g, "-")}.pdf`;
    doc.save(fileName);
  } finally {
    document.body.removeChild(wrapper);
  }
}

// ── Akıllı öneri & analiz üreteci ────────────────────────────────────────

function buildTips(data: DashboardData): string[] {
  const tips: string[] = [];
  const { summary, sgkVsCash, promissoryNotes } = data;

  if (summary.netProfit < 0)
    tips.push("Giderleriniz gelirlerinizi aşıyor. Sabit giderleri gözden geçirin.");
  else if (summary.netProfit > 0)
    tips.push(`Bu ay ${fmtTL(summary.netProfit)} net kâr elde edildi.`);

  const sgkRatio = sgkVsCash.sgkTotal / (sgkVsCash.sgkTotal + sgkVsCash.cashTotal || 1);
  if (sgkRatio > 0.7)
    tips.push("SGK oranınız %70+ — platform gelirlerini artırmak dengeyi iyileştirir.");
  else if (sgkRatio < 0.4)
    tips.push("Elden satış oranınız yüksek — SGK faturalarını sisteme eklemek gelir tahminini iyileştirir.");

  const unpaid = promissoryNotes.filter(n => !n.isPaid);
  if (unpaid.length > 0) {
    const urgent = unpaid.filter(n => Math.ceil((new Date(n.dueDate).getTime() - Date.now()) / 86400000) <= 7);
    if (urgent.length > 0)
      tips.push(`${urgent.length} senedin vadesi 7 gün içinde! Ödeme planlayın.`);
    else
      tips.push(`${unpaid.length} adet ödenmemiş senet takipte.`);
  }

  if (data.upcomingSgk.length > 0) {
    const totalSgk = data.upcomingSgk.reduce((s, x) => s + x.amount, 0);
    tips.push(`Önümüzdeki 3 ayda ${fmtTL(totalSgk)} SGK ödemesi bekleniyor.`);
  }

  if (tips.length < 3) tips.push("Envanter raporunu düzenli yüklemek kârlılığınızı görmenizi sağlar.");
  return tips.slice(0, 5);
}

function buildAnalysis(data: DashboardData): Array<{ heading: string; lines: string[] }> {
  const sections: Array<{ heading: string; lines: string[] }> = [];
  const { summary, sgkVsCash, monthlyTrend } = data;
  const margin = summary.totalIncome > 0 ? (summary.netProfit / summary.totalIncome) * 100 : 0;

  sections.push({
    heading: "Kâr Marjı Analizi",
    lines: [`Kâr Marjı: %${margin.toFixed(1)} (Gelir: ${fmtTL(summary.totalIncome)}, Gider: ${fmtTL(summary.totalExpense)})`],
  });

  const total = sgkVsCash.sgkTotal + sgkVsCash.cashTotal || 1;
  sections.push({
    heading: "SGK Analizi",
    lines: [`SGK: %${((sgkVsCash.sgkTotal / total) * 100).toFixed(0)} | Elden: %${((sgkVsCash.cashTotal / total) * 100).toFixed(0)}`],
  });

  if (monthlyTrend.length >= 2) {
    const last = monthlyTrend[monthlyTrend.length - 1];
    const prev = monthlyTrend[monthlyTrend.length - 2];
    sections.push({
      heading: "Trend Analizi (Son 2 Ay)",
      lines: [`Gelir değişimi: ${pctChange(last.gelir, prev.gelir)} | Gider: ${pctChange(last.gider, prev.gider)}`],
    });
  }

  return sections;
}

function buildActions(data: DashboardData): string[] {
  const actions: string[] = [];
  const unpaid = data.promissoryNotes.filter(n => !n.isPaid);
  const urgent = unpaid.filter(n => Math.ceil((new Date(n.dueDate).getTime() - Date.now()) / 86400000) <= 14);

  if (urgent.length > 0) actions.push(`${urgent.length} senedin ödemesini planlayın (14 gün içinde).`);
  if (data.upcomingSgk.length > 0) actions.push("SGK ödeme tarihlerini takvime ekleyin.");
  if (data.platformIncome.length === 0) actions.push("Platform gelirlerinizi bu ay sisteme girin.");
  if (data.summary.netProfit < 0) actions.push("Gider kalemlerini gözden geçirin, tasarruf alanları belirleyin.");
  actions.push("Aylık envanter raporunu yükleyin — kârlılık analizini günceller.");
  actions.push("SGK faturalarınızı PDF olarak yükleyin, sistem otomatik okur.");
  return actions.slice(0, 7);
}

function calcScore(data: DashboardData): { value: number; label: string; color: string } {
  let score = 50;
  const { summary } = data;
  if (summary.netProfit > 0) score += 20;
  if (summary.netProfit > summary.totalIncome * 0.2) score += 10;
  const unpaid = data.promissoryNotes.filter(n => !n.isPaid);
  if (unpaid.length === 0) score += 10;
  if (data.platformIncome.length > 0) score += 5;
  if (data.upcomingSgk.length > 0) score += 5;
  score = Math.min(100, Math.max(10, score));

  if (score >= 75) return { value: score, label: "İyi", color: COLORS.primary };
  if (score >= 50) return { value: score, label: "Orta", color: "#f5a623" };
  return { value: score, label: "Dikkat Gerekiyor", color: COLORS.danger };
}
