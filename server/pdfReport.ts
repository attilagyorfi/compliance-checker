import PDFDocument from "pdfkit";
import type { Analysis, ComplianceResult, ComplianceStatus } from "../drizzle/schema";

const BRAND_STEEL = "#7CA9D3";
const BRAND_DARK = "#161718";
const STATUS_COLORS: Record<ComplianceStatus, { text: string; bg: string }> = {
  megfelel: { text: "#16a34a", bg: "#f0fdf4" },
  bizonytalan: { text: "#ca8a04", bg: "#fefce8" },
  nem_felel_meg: { text: "#dc2626", bg: "#fef2f2" },
  reszben_megfelel: { text: "#ea580c", bg: "#fff7ed" },
};
const STATUS_LABELS: Record<ComplianceStatus, string> = {
  megfelel: "MEGFELEL",
  bizonytalan: "BIZONYTALAN",
  nem_felel_meg: "NEM FELEL MEG",
  reszben_megfelel: "RÉSZBEN MEGFELEL",
};

export function generatePdfReport(analysis: Analysis): Promise<Buffer> {
  return new Promise((resolve, reject) => {
  const results: ComplianceResult[] = (analysis.results as ComplianceResult[]) || [];
  const pass = results.filter((r) => r.status === "megfelel").length;
  const uncertain = results.filter((r) => r.status === "bizonytalan").length;
  const fail = results.filter((r) => r.status === "nem_felel_meg").length;

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    info: {
      Title: `Megfelelőségi Riport – ${analysis.title}`,
      Author: "M Mérnöki Iroda Kft.",
      Subject: "Tervmegfelelőség-ellenőrzés",
    },
  });

  const buffers: Buffer[] = [];
  doc.on("data", (chunk) => buffers.push(chunk));
  doc.on("end", () => resolve(Buffer.concat(buffers)));
  doc.on("error", reject);

  const pageWidth = doc.page.width - 120; // margins

  // ── Header ────────────────────────────────────────────────────────────────
  // Dark header bar
  doc.rect(0, 0, doc.page.width, 80).fill(BRAND_DARK);

  doc
    .fillColor("white")
    .fontSize(18)
    .font("Helvetica-Bold")
    .text("M Mérnöki Iroda Kft.", 60, 22);

  doc
    .fillColor(BRAND_STEEL)
    .fontSize(9)
    .font("Helvetica")
    .text("TERVMEGFELELŐSÉG-ELLENŐRZŐ RENDSZER", 60, 46, { characterSpacing: 1.5 });

  // Date top-right
  doc
    .fillColor("white")
    .fontSize(8)
    .text(
      new Date().toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" }),
      0,
      32,
      { align: "right", width: doc.page.width - 60 }
    );

  doc.moveDown(3);

  // ── Title section ─────────────────────────────────────────────────────────
  doc
    .fillColor(BRAND_DARK)
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("MEGFELELŐSÉGI RIPORT", 60, 110);

  // Steel underline
  doc.rect(60, 135, 60, 3).fill(BRAND_STEEL);

  doc.moveDown(0.5);

  doc
    .fillColor("#374151")
    .fontSize(13)
    .font("Helvetica-Bold")
    .text(analysis.title, 60, 148);

  // Meta info
  doc
    .fillColor("#6b7280")
    .fontSize(9)
    .font("Helvetica")
    .text(
      `Tervdokumentum: ${(analysis.planDocuments as any)?.[0]?.name || "–"}   ·   Elemzés dátuma: ${new Date(analysis.createdAt).toLocaleDateString("hu-HU")}`,
      60,
      170
    );

  doc.moveDown(2);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const statsY = 200;
  const boxW = (pageWidth - 20) / 3;
  const statsData = [
    { label: "Megfelel", value: pass, color: "#16a34a" },
    { label: "Bizonytalan", value: uncertain, color: "#ca8a04" },
    { label: "Nem felel meg", value: fail, color: "#dc2626" },
  ];

  statsData.forEach(({ label, value, color }, i) => {
    const x = 60 + i * (boxW + 10);
    doc.rect(x, statsY, boxW, 60).fillAndStroke("#f9fafb", "#e5e7eb");
    doc.fillColor(color).fontSize(28).font("Helvetica-Bold").text(String(value), x, statsY + 8, { width: boxW, align: "center" });
    doc.fillColor(color).fontSize(9).font("Helvetica").text(label.toUpperCase(), x, statsY + 40, { width: boxW, align: "center" });
  });

  doc.moveDown(1);

  // ── Summary text ──────────────────────────────────────────────────────────
  if (analysis.summary) {
    const summaryY = statsY + 80;
    doc.rect(60, summaryY, pageWidth, 1).fill(BRAND_STEEL);
    doc
      .fillColor(BRAND_DARK)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("ÖSSZEFOGLALÓ ÉRTÉKELÉS", 60, summaryY + 10);
    doc
      .fillColor("#374151")
      .fontSize(9.5)
      .font("Helvetica")
      .text(analysis.summary, 60, summaryY + 26, { width: pageWidth, lineGap: 3 });

    doc.y = summaryY + 26 + doc.heightOfString(analysis.summary, { width: pageWidth }) + 20;
  } else {
    doc.y = statsY + 80;
  }

  // ── Results ───────────────────────────────────────────────────────────────
  doc.rect(60, doc.y, pageWidth, 1).fill(BRAND_STEEL);
  doc.y += 12;

  doc
    .fillColor(BRAND_DARK)
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("ELLENŐRZÉSI PONTOK", 60, doc.y);

  doc.y += 18;

  results.forEach((result, idx) => {
    const cfg = STATUS_COLORS[result.status];
    const label = STATUS_LABELS[result.status];

    // Check if we need a new page
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
      doc.y = 60;
    }

    const cardY = doc.y;
    doc.fontSize(10);
    const titleHeight = doc.heightOfString(result.title, { width: pageWidth - 100 });
    doc.fontSize(8.5);
    const descHeight = doc.heightOfString(result.description, { width: pageWidth - 20 });
    const justHeight = doc.heightOfString(result.justification, { width: pageWidth - 20 });
    const cardHeight = titleHeight + descHeight + justHeight + 80;

    // Card background
    doc.rect(60, cardY, pageWidth, cardHeight).fillAndStroke("white", "#e5e7eb");

    // Left status bar
    const barColor =
      result.status === "megfelel" ? "#16a34a"
      : result.status === "bizonytalan" ? "#ca8a04"
      : "#dc2626";
    doc.rect(60, cardY, 4, cardHeight).fill(barColor);

    // Status badge
    const badgeX = doc.page.width - 60 - 90;
    doc.rect(badgeX, cardY + 10, 90, 18).fill(cfg.text);
    doc
      .fillColor("white")
      .fontSize(7.5)
      .font("Helvetica-Bold")
      .text(label, badgeX, cardY + 14, { width: 90, align: "center", characterSpacing: 0.3 });

    // Title
    doc
      .fillColor(BRAND_DARK)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(result.title, 72, cardY + 12, { width: pageWidth - 110 });

    // Description
    doc
      .fillColor("#6b7280")
      .fontSize(8.5)
      .font("Helvetica")
      .text(result.description, 72, cardY + 14 + titleHeight + 4, { width: pageWidth - 20 });

    // Separator
    const sepY = cardY + 14 + titleHeight + 4 + descHeight + 8;
    doc.rect(72, sepY, pageWidth - 20, 0.5).fill("#e5e7eb");

    // Justification label
    doc
      .fillColor("#9ca3af")
      .fontSize(7.5)
      .font("Helvetica-Bold")
      .text("INDOKLÁS", 72, sepY + 8, { characterSpacing: 0.8 });

    // Justification text
    doc
      .fillColor("#374151")
      .fontSize(8.5)
      .font("Helvetica")
      .text(result.justification, 72, sepY + 20, { width: pageWidth - 20 });

    // Reference
    const refY = sepY + 20 + justHeight + 6;
    doc
      .fillColor("#9ca3af")
      .fontSize(7.5)
      .font("Helvetica-Bold")
      .text("HIVATKOZÁS: ", 72, refY, { continued: true, characterSpacing: 0.8 });
    doc
      .fillColor(BRAND_STEEL)
      .fontSize(8)
      .font("Helvetica")
      .text(result.reference, { characterSpacing: 0 });

    doc.y = cardY + cardHeight + 8;
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = doc.page.height - 50;
  doc.rect(0, footerY, doc.page.width, 50).fill(BRAND_DARK);
  doc
    .fillColor("#9ca3af")
    .fontSize(8)
    .font("Helvetica")
    .text(
      `M Mérnöki Iroda Kft. · Tervmegfelelőség-ellenőrző Pilot · ${new Date().toLocaleDateString("hu-HU")}`,
      60,
      footerY + 18,
      { align: "center", width: doc.page.width - 120 }
    );

  doc.end();
  }); // end Promise
}
