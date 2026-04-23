import React, { forwardRef } from "react";

export const CAFE = {
  name: "Deja Brew",
  address: "No.G4(1069), 19th Street G Block, Anna Nagar West, Chennai",
  phone: "9176615050",
  gstin: "33AAXFD6102D1ZO",
  fssai: "0",
};

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${mi}:${ss}`;
}

/**
 * Renders a thermal-style 80mm bill (for customer) or KOT (for kitchen).
 * kind: "bill" | "kot"
 * Rendered INSIDE a hidden container that window.print() will show via CSS.
 */
export const PrintableReceipt = forwardRef(({ bill, kind = "bill" }, ref) => {
  if (!bill) return null;

  if (kind === "kot") {
    return (
      <div ref={ref} className="print-receipt" data-receipt-kind="kot">
        <div className="center bold lg">KOT</div>
        <div className="center">{CAFE.name}</div>
        <div className="row"><span>Token No:</span><span>{bill.bill_number || "SELFSERVICE"}</span></div>
        <div className="row"><span>Order Id:</span><span>{bill.bill_number}</span></div>
        <div className="row"><span>Bill No:</span><span>{bill.bill_number}</span></div>
        <div className="row"><span>Date:</span><span>{fmtDateTime(bill.created_at)}</span></div>
        <div className="divider" />
        <div className="kot-header">
          <span style={{ width: "10%" }}>QTY</span>
          <span style={{ width: "60%" }}>Dish Name</span>
          <span style={{ width: "30%" }}>Remarks</span>
        </div>
        <div className="divider" />
        {(bill.items || []).map((it, i) => (
          <div key={i} className="kot-row">
            <span style={{ width: "10%" }}>{it.quantity}</span>
            <span style={{ width: "60%" }}>{it.name}</span>
            <span style={{ width: "30%" }} />
          </div>
        ))}
        <div className="divider" />
        <div className="row"><span>Total no of kot:</span><span>{(bill.items || []).length}</span></div>
      </div>
    );
  }

  // Customer bill
  return (
    <div ref={ref} className="print-receipt" data-receipt-kind="bill">
      <div className="center bold lg">{CAFE.name}</div>
      <div className="center sm">{CAFE.address}</div>
      <div className="center sm">Phone: {CAFE.phone}</div>
      <div className="center sm">GSTIN: {CAFE.gstin}</div>
      <div className="center sm">FSSAI Code: {CAFE.fssai}</div>
      <div className="divider" />
      <div className="row"><span>Bill No:</span><span>{bill.bill_number}</span></div>
      <div className="row"><span>Token No:</span><span>SELFSERVICE</span></div>
      <div className="row"><span>Date:</span><span>{fmtDateTime(bill.created_at)}</span></div>
      {bill.customer_name && <div className="row"><span>Customer:</span><span>{bill.customer_name}</span></div>}
      <div className="divider" />
      <div className="item-header">
        <span style={{ width: "46%" }}>ITEM NAME</span>
        <span style={{ width: "18%", textAlign: "right" }}>PRICE</span>
        <span style={{ width: "12%", textAlign: "right" }}>QTY</span>
        <span style={{ width: "24%", textAlign: "right" }}>SUB</span>
      </div>
      <div className="divider" />
      {(bill.items || []).map((it, i) => (
        <div key={i} className="item-row">
          <span style={{ width: "46%" }}>{it.name}</span>
          <span style={{ width: "18%", textAlign: "right" }}>{(it.price || 0).toFixed(2)}</span>
          <span style={{ width: "12%", textAlign: "right" }}>{it.quantity}</span>
          <span style={{ width: "24%", textAlign: "right" }}>{(it.subtotal || 0).toFixed(2)}</span>
        </div>
      ))}
      <div className="divider" />
      <div className="row"><span>Sub Total</span><span>RS {(bill.subtotal || 0).toFixed(3)}</span></div>
      {bill.overall_discount > 0 && (
        <div className="row"><span>Discount</span><span>- RS {(bill.overall_discount || 0).toFixed(3)}</span></div>
      )}
      <div className="row"><span>CGST: 2.50%</span><span>{(bill.cgst || 0).toFixed(3)}</span></div>
      <div className="row"><span>SGST: 2.50%</span><span>{(bill.sgst || 0).toFixed(3)}</span></div>
      <div className="row"><span>Round Off</span><span>0.000</span></div>
      <div className="divider" />
      <div className="row bold lg"><span>Total</span><span>RS {(bill.total || 0).toFixed(3)}</span></div>
      <div className="divider" />
      <div className="row sm"><span>Settlement Type:</span><span>{(bill.payment_mode === "cash+upi" ? "SPLIT" : (bill.payment_mode || "").toUpperCase())}-{(bill.total || 0).toFixed(1)}</span></div>
      {bill.customer_phone && <div className="row sm"><span>Cust mobile:</span><span>{bill.customer_phone}</span></div>}
      <div className="row sm"><span>Delivery Time:</span><span>null</span></div>
      <div className="divider" />
      <div className="center sm">Thank you! Visit again.</div>
    </div>
  );
});

PrintableReceipt.displayName = "PrintableReceipt";

export function triggerPrint() {
  window.print();
}
