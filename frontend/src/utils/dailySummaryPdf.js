import { CAFE } from "../components/PrintableReceipt";

const money = (n) => `Rs.${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n) => (Number(n) || 0).toLocaleString("en-IN");

function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const BROWN = [139, 90, 43];
const CREAM = [246, 243, 236];
const DARK = [44, 36, 27];

/**
 * Build the daily-summary report as a jsPDF document (portrait A4).
 * Returns the jsPDF instance so callers can .save() or .output("blob").
 */
export async function buildDailySummaryDoc(data) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 40;
  const b = data?.breakup || {};

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...DARK);
  doc.text(CAFE.name, pageW / 2, 46, { align: "center" });
  doc.setFontSize(12);
  doc.setTextColor(...BROWN);
  doc.text("Daily Summary - Category Wise Report", pageW / 2, 64, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(90, 80, 70);
  doc.text(
    `Date: ${fmtDate(data.date)}     Bills: ${num(data.bills)}     Items Sold: ${num(data.totals?.qty)}`,
    pageW / 2, 82, { align: "center" }
  );
  doc.setFontSize(8);
  doc.setTextColor(150, 140, 130);
  doc.text(`Generated: ${new Date(data.generated_at || Date.now()).toLocaleString("en-IN")}`, pageW / 2, 95, { align: "center" });

  let y = 112;

  const baseStyles = { fontSize: 9, cellPadding: 4, textColor: DARK, lineColor: [220, 210, 195], lineWidth: 0.5 };
  const rightCols = { 1: { halign: "right", cellWidth: 60 }, 2: { halign: "right", cellWidth: 90 } };

  // Category tables
  (data.categories || []).forEach((cat) => {
    autoTable(doc, {
      startY: y,
      head: [[cat.category, "Qty", "Amount"]],
      body: (cat.items || []).map((it) => [it.name, num(it.count), money(it.amount)]),
      foot: [[`Total  -  ${(Number(cat.percent) || 0).toFixed(2)}%`, num(cat.qty), money(cat.total)]],
      theme: "grid",
      styles: baseStyles,
      headStyles: { fillColor: BROWN, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9.5 },
      footStyles: { fillColor: CREAM, textColor: DARK, fontStyle: "bold" },
      columnStyles: rightCols,
      margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY + 12;
  });

  // Sales Breakup
  const breakupBody = [
    ["Cash", money(b.cash)],
    ["Card / UPI", money(b.upi)],
    ["Cash + Card", money(b.collected)],
    ["Gross (w/o Discount)", money(b.gross)],
    ["Customer Discount", money(b.total_discount)],
    ["Complementary", money(b.complementary)],
    ["Net Sales Without Tax", money(b.net_without_tax)],
    ["CGST", money(b.cgst)],
    ["SGST", money(b.sgst)],
    ...(b.service_charge ? [["Service Charge", money(b.service_charge)]] : []),
    ["Tax Amount", money(b.tax)],
    ["Round Off", money(b.round_off)],
    ["Net Sales With Tax", money(b.net_with_tax)],
  ];
  autoTable(doc, {
    startY: y,
    head: [["Sales Breakup", ""]],
    body: breakupBody,
    theme: "grid",
    styles: baseStyles,
    headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 220 }, 1: { halign: "right" } },
    margin: { left: M, right: pageW / 2 + 6 },
    tableWidth: pageW / 2 - M - 6,
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.row.index === breakupBody.length - 1) {
        hook.cell.styles.fontStyle = "bold";
        hook.cell.styles.textColor = BROWN;
      }
    },
  });
  const breakupEndY = doc.lastAutoTable.finalY;

  // Payment Summary (side by side, right column)
  autoTable(doc, {
    startY: y,
    head: [["Payment", "Bills", "Amount"]],
    body: (data.payment_modes || []).map((p) => [p.label, num(p.bills), money(p.amount)]),
    foot: [["Grand Total", num(data.bills), money(b.net_with_tax)]],
    theme: "grid",
    styles: baseStyles,
    headStyles: { fillColor: [62, 92, 70], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: CREAM, textColor: DARK, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    margin: { left: pageW / 2 + 6, right: M },
    tableWidth: pageW / 2 - M - 6,
  });

  const footerY = Math.max(breakupEndY, doc.lastAutoTable.finalY) + 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 140, 130);
  doc.text(`${CAFE.name}  -  ${CAFE.address2}  -  GSTIN: ${CAFE.gstin}`, pageW / 2, Math.min(footerY, doc.internal.pageSize.getHeight() - 24), { align: "center" });

  return doc;
}

/** Convenience: the report as a PDF File, ready for navigator.share / download. */
export async function buildDailySummaryFile(data) {
  const doc = await buildDailySummaryDoc(data);
  const blob = doc.output("blob");
  return new File([blob], `daily-summary-${data.date}.pdf`, { type: "application/pdf" });
}
