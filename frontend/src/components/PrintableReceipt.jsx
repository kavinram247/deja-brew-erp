const CAFE = {
  name: "Deja Brew",
  address1: "No.G4(1069), 19th Street G Block,",
  address2: "Anna Nagar West, Chennai",
  phone: "9176615050",
  gstin: "33AAXFD6102D1ZO",
  fssai: "",
};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtDT(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const BILL_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',Courier,monospace;font-size:11px;line-height:1.4;color:#000;background:#fff;width:72mm;padding:4mm 3mm}
@page{size:76mm auto;margin:0}
.tc{text-align:center}
.bold{font-weight:700}
.lg{font-size:15px;letter-spacing:.5px}
.sm{font-size:9.5px}
.xs{font-size:8.5px}
hr{border:none;border-top:1px dashed #000;margin:4px 0}
hr.s{border-top-style:solid}
.row{display:flex;justify-content:space-between;align-items:baseline;line-height:1.7}
.row-lg{display:flex;justify-content:space-between;font-weight:700;font-size:15px;margin:3px 0}
.logo{display:block;max-width:22mm;height:auto;margin:0 auto 5px}
table{width:100%;border-collapse:collapse}
thead tr{border-bottom:1px solid #000}
th{font-size:9px;text-transform:uppercase;padding:2px 0;font-weight:700}
td{font-size:10.5px;padding:2px 0;vertical-align:top}
.r{text-align:right}
.cn{width:46%}
.cq{width:10%}
.cp{width:22%}
.ca{width:22%}
`;

const KOT_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.5;color:#000;background:#fff;width:72mm;padding:4mm 3mm}
@page{size:76mm auto;margin:0}
.tc{text-align:center}
.bold{font-weight:700}
.lg{font-size:20px;letter-spacing:1px}
hr{border:none;border-top:1px dashed #000;margin:4px 0}
hr.s{border-top:2px solid #000;margin:3px 0}
.row{display:flex;justify-content:space-between;line-height:1.7}
table{width:100%;border-collapse:collapse}
thead tr{border-top:1px solid #000;border-bottom:2px solid #000}
th{font-weight:700;padding:3px 0;font-size:11px}
td{font-size:14px;font-weight:700;padding:3px 0;vertical-align:top}
.cq{width:16%}
.cn{width:84%}
`;

export function generateReceiptHtml(bill, kind = "bill") {
  if (!bill) return "<!DOCTYPE html><html><body></body></html>";

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const items = bill.items || [];

  if (kind === "kot") {
    const rows = items
      .map((it) => `<tr><td class="cq">${it.quantity}</td><td class="cn">${esc(it.name)}</td></tr>`)
      .join("");

    const body = `
<div class="tc bold lg">** KOT **</div>
<div class="tc bold" style="font-size:14px">${esc(CAFE.name)}</div>
<hr class="s">
<div class="row"><span>Bill No</span><span>${esc(bill.bill_number || "—")}</span></div>
<div class="row"><span>Date</span><span>${fmtDT(bill.created_at)}</span></div>
${bill.customer_name ? `<div class="row"><span>Customer</span><span>${esc(bill.customer_name)}</span></div>` : ""}
<hr>
<table>
<thead><tr><th class="cq">Qty</th><th class="cn">Item</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<hr>
<div class="row" style="font-size:10px"><span>Total items:</span><span>${items.length}</span></div>
<div style="height:8mm"></div>`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${origin}/"><style>${KOT_CSS}</style></head><body>${body}</body></html>`;
  }

  // Bill receipt
  const subtotal = bill.subtotal || 0;
  const discount = bill.overall_discount || 0;
  const cgst = bill.cgst || 0;
  const sgst = bill.sgst || 0;
  const serviceCharge = bill.service_charge_enabled ? (bill.service_charge || 0) : 0;
  const roundOff = typeof bill.round_off === "number" ? bill.round_off : 0;
  const total = bill.total || 0;

  const pm = (bill.payment_mode || "").toLowerCase();
  let paymentRows = "";
  if (pm === "cash+upi") {
    paymentRows = `
<div class="row"><span>Payment</span><span>SPLIT</span></div>
<div class="row sm"><span>&nbsp;&nbsp;Cash</span><span>&#8377;${Math.round(bill.cash_amount || 0)}</span></div>
<div class="row sm"><span>&nbsp;&nbsp;UPI</span><span>&#8377;${Math.round(bill.upi_amount || 0)}</span></div>`;
  } else {
    const label = pm === "cash" ? "CASH" : pm === "upi" ? "UPI" : pm === "card" ? "CARD" : esc(pm).toUpperCase();
    paymentRows = `<div class="row"><span>Payment</span><span>${label} &mdash; &#8377;${Math.round(total)}</span></div>`;
  }

  const itemRows = items
    .map(
      (it) => `<tr>
  <td class="cn">${esc(it.name)}</td>
  <td class="cq r">${it.quantity}</td>
  <td class="cp r">${(it.price || 0).toFixed(2)}</td>
  <td class="ca r">${(it.subtotal || 0).toFixed(2)}</td>
</tr>`
    )
    .join("");

  const body = `
<img class="logo" src="deja-brew-logo.png" alt="" onerror="this.style.display='none'">
<div class="tc bold lg">${esc(CAFE.name).toUpperCase()}</div>
<div class="tc sm">${esc(CAFE.address1)}</div>
<div class="tc sm">${esc(CAFE.address2)}</div>
<div class="tc sm">Ph: ${esc(CAFE.phone)}</div>
<div class="tc sm">GSTIN: ${esc(CAFE.gstin)}</div>
<hr>
<div class="row"><span>Bill No</span><span>${esc(bill.bill_number || "—")}</span></div>
<div class="row"><span>Date</span><span>${fmtDT(bill.created_at)}</span></div>
${bill.customer_name ? `<div class="row"><span>Customer</span><span>${esc(bill.customer_name)}</span></div>` : ""}
<hr>
<table>
<thead><tr>
  <th class="cn">Item</th>
  <th class="cq r">Qty</th>
  <th class="cp r">Rate</th>
  <th class="ca r">Amt</th>
</tr></thead>
<tbody>${itemRows}</tbody>
</table>
<hr>
<div class="row"><span>Sub Total</span><span>&#8377;${subtotal.toFixed(2)}</span></div>
${discount > 0 ? `<div class="row"><span>Discount</span><span>-&#8377;${discount.toFixed(2)}</span></div>` : ""}
<div class="row"><span>CGST @ 2.5%</span><span>&#8377;${cgst.toFixed(2)}</span></div>
<div class="row"><span>SGST @ 2.5%</span><span>&#8377;${sgst.toFixed(2)}</span></div>
${bill.service_charge_enabled ? `<div class="row"><span>Service Charge @ 5%</span><span>&#8377;${serviceCharge.toFixed(2)}</span></div>` : ""}
${roundOff !== 0 ? `<div class="row"><span>Round Off</span><span>${roundOff > 0 ? "+" : "-"}&#8377;${Math.abs(roundOff).toFixed(2)}</span></div>` : ""}
<hr class="s">
<div class="row-lg"><span>TOTAL</span><span>&#8377;${Math.round(total)}</span></div>
<hr class="s">
${paymentRows}
${bill.customer_phone ? `<div class="row sm"><span>Mobile</span><span>${esc(bill.customer_phone)}</span></div>` : ""}
<hr>
<div class="tc" style="margin-top:2px">Thank you! Visit again.</div>
${CAFE.fssai ? `<div class="tc xs" style="margin-top:2px">FSSAI: ${esc(CAFE.fssai)}</div>` : ""}
<div style="height:10mm"></div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${origin}/"><title>${esc(bill.bill_number || "receipt")}</title><style>${BILL_CSS}</style></head><body>${body}</body></html>`;
}

export { CAFE };
