import { CAFE } from "../components/PrintableReceipt";

/** Escape untrusted strings before injecting into the print HTML. */
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const money = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n) => (Number(n) || 0).toLocaleString("en-IN");

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1c1c1c;font-size:12px;line-height:1.4;padding:22px 26px}
@page{size:A4;margin:14mm}
h1{font-size:22px;font-weight:700;text-align:center;letter-spacing:.5px}
.sub{text-align:center;font-size:14px;font-weight:600;margin-top:2px;color:#5a4633}
.meta{display:flex;justify-content:center;gap:26px;font-size:11px;color:#555;margin:8px 0 4px}
.meta b{color:#1c1c1c;font-weight:600}
hr{border:none;border-top:1px solid #cbb89b;margin:12px 0}
h2{font-size:13px;font-weight:700;margin:16px 0 6px;color:#5a4633;text-transform:uppercase;letter-spacing:.4px}
.cat{font-size:12.5px;font-weight:700;margin:14px 0 4px;color:#1c1c1c}
table{width:100%;border-collapse:collapse;margin-bottom:2px}
th,td{padding:4px 8px;font-size:11.5px}
thead th{background:#f1e9dc;text-align:left;font-weight:700;border-bottom:1px solid #cbb89b}
tbody td{border-bottom:1px solid #ece4d6}
.r{text-align:right}
tr.tot td{font-weight:700;border-top:1px solid #cbb89b;border-bottom:none;background:#faf6ee}
.breakup{width:100%;max-width:420px}
.breakup td{padding:3px 8px;font-size:12px;border:none}
.breakup td.r{font-weight:600}
.breakup tr.grand td{border-top:1.5px solid #1c1c1c;font-weight:700;font-size:13px;padding-top:6px}
.breakup tr.rule td{border-top:1px dashed #999}
.foot{margin-top:18px;text-align:center;font-size:10px;color:#999}
.two{display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start}
.two>div{flex:1;min-width:260px}
`;

function categoryBlock(cat) {
  const rows = (cat.items || [])
    .map(
      (it) => `<tr><td>${esc(it.name)}</td><td class="r">${num(it.count)}</td><td class="r">${money(it.amount)}</td></tr>`
    )
    .join("");
  return `
<div class="cat">${esc(cat.category)}</div>
<table>
  <thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Amount</th></tr></thead>
  <tbody>
    ${rows}
    <tr class="tot"><td>Total &middot; ${num(cat.qty)} qty &middot; ${(Number(cat.percent) || 0).toFixed(2)}%</td><td class="r">${num(cat.qty)}</td><td class="r">${money(cat.total)}</td></tr>
  </tbody>
</table>`;
}

export function generateDailySummaryHtml(data) {
  if (!data) return "<!DOCTYPE html><html><body></body></html>";
  const b = data.breakup || {};
  const cats = (data.categories || []).map(categoryBlock).join("");

  const payRows = (data.payment_modes || [])
    .map((p) => `<tr><td>${esc(p.label)}</td><td class="r">${num(p.bills)}</td><td class="r">${money(p.amount)}</td></tr>`)
    .join("");

  const breakupRows = [
    ["Cash", b.cash],
    ["Card / UPI", b.upi],
    ["Cash + Card", b.collected, "rule"],
    ["Gross (w/o Discount)", b.gross],
    ["Customer Discount", b.total_discount],
    ["Complementary", b.complementary],
    ["Net Sales Without Tax", b.net_without_tax, "rule"],
    ["CGST", b.cgst],
    ["SGST", b.sgst],
    ...(b.service_charge ? [["Service Charge", b.service_charge]] : []),
    ["Tax Amount", b.tax],
    ["Round Off", b.round_off],
  ]
    .map(([label, val, cls]) => `<tr class="${cls || ""}"><td>${esc(label)}</td><td class="r">${money(val)}</td></tr>`)
    .join("");

  const body = `
<h1>${esc(CAFE.name)}</h1>
<div class="sub">Daily Summary &mdash; Category Wise Report</div>
<div class="meta">
  <span><b>Date:</b> ${fmtDate(data.date)}</span>
  <span><b>Bills:</b> ${num(data.bills)}</span>
  <span><b>Items Sold:</b> ${num(data.totals?.qty)}</span>
  <span><b>Generated:</b> ${new Date(data.generated_at || Date.now()).toLocaleString("en-IN")}</span>
</div>
<hr>
${cats || '<p style="text-align:center;color:#999;margin:20px 0">No sales recorded for this day.</p>'}
<hr>
<div class="two">
  <div>
    <h2>Sales Breakup Summary</h2>
    <table class="breakup">
      <tbody>
        ${breakupRows}
        <tr class="grand"><td>Net Sales With Tax</td><td class="r">${money(b.net_with_tax)}</td></tr>
      </tbody>
    </table>
  </div>
  <div>
    <h2>Payment Summary</h2>
    <table>
      <thead><tr><th>Mode</th><th class="r">Bills</th><th class="r">Amount</th></tr></thead>
      <tbody>
        ${payRows || '<tr><td colspan="3" style="color:#999">No bills</td></tr>'}
        <tr class="tot"><td>Grand Total</td><td class="r">${num(data.bills)}</td><td class="r">${money(b.net_with_tax)}</td></tr>
      </tbody>
    </table>
  </div>
</div>
<div class="foot">${esc(CAFE.name)} &middot; ${esc(CAFE.address2)} &middot; GSTIN: ${esc(CAFE.gstin)}</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Daily Summary ${esc(data.date)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

/** Print the daily summary via a hidden iframe (no page flash), same pattern as receipts. */
export function printDailySummary(data) {
  const html = generateDailySummaryHtml(data);
  const frame = document.createElement("iframe");
  frame.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);

  const prevTitle = document.title;
  document.title = `Daily Summary ${data?.date || ""}`;

  frame.contentDocument.open();
  frame.contentDocument.write(html);
  frame.contentDocument.close();

  const cleanup = () => {
    document.title = prevTitle;
    try { document.body.removeChild(frame); } catch (_) {}
  };

  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    frame.contentWindow.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(cleanup, 30000);
  }, 80);
}
