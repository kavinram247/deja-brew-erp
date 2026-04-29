import React, { useState, useEffect, useRef } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Receipt, ChevronLeft, ChevronRight, Eye, X, Printer, ChefHat, Edit2, Plus, Minus, Trash2 } from "lucide-react";
import ThemeDatePicker from "../../components/ThemeDatePicker";
import { todayYMD, shiftYMD } from "../../utils/date";
import { usePrint } from "../../components/usePrint";

const TAX = 0.025;
const SERVICE_RATE = 0.05;

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function EntryBills() {
  const today = todayYMD();
  const [date, setDate] = useState(today);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);
  const [showBill, setShowBill] = useState(null);
  const [editBill, setEditBill] = useState(null);
  const { printBill, printKot, PrintHost } = usePrint();

  const load = async (d = date) => {
    setLoading(true);
    try { const { data } = await api.get(`/bills?date_str=${d}`); setBills(data); hasLoaded.current = true; }
    catch { toast.error("Failed to load bills"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(date); }, [date]); // eslint-disable-line

  const changeDate = (delta) => {
    setDate(shiftYMD(date, delta));
  };

  const totalRev = bills.reduce((s, b) => s + (b.total || 0), 0);
  const totalCash = bills.reduce((s, b) => s + (b.cash_amount || 0), 0);
  const totalUpi = bills.reduce((s, b) => s + (b.upi_amount || 0), 0);

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <PrintHost />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Bills · Customer Details</h1>
          <p className="text-[#8A7D71] text-sm mt-1">View, edit & reprint · {date === today ? "Today" : date}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"><ChevronLeft size={16} /></button>
          <ThemeDatePicker value={date} onChange={setDate} max={today} testid="entry-bills-date" />
          <button onClick={() => changeDate(1)} disabled={date >= today} className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10 disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Bills", value: bills.length, color: "#3E5C46", testid: "eb-count" },
          { label: "Revenue", value: `₹${totalRev.toLocaleString("en-IN")}`, color: "#8B5A2B", testid: "eb-rev" },
          { label: "Cash", value: `₹${totalCash.toLocaleString("en-IN")}`, color: "#D48B3D", testid: "eb-cash" },
          { label: "UPI", value: `₹${totalUpi.toLocaleString("en-IN")}`, color: "#C06C4C", testid: "eb-upi" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid={s.testid}>
            <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color, fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        <div className="px-5 py-4 border-b border-amber-900/10">
          <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Customer Details</h2>
        </div>
        {loading && !hasLoaded.current ? <div className="text-center text-[#8A7D71] py-10">Loading...</div>
          : !loading && bills.length === 0 ? (
            <div className="text-center py-12">
              <Receipt size={36} className="text-[#C9B99A] mx-auto mb-2" />
              <p className="text-[#8A7D71] text-sm">No bills on this date</p>
            </div>
          ) : (
            <div className={`overflow-x-auto transition-opacity duration-150 ${loading ? "opacity-50" : "opacity-100"}`}>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-amber-900/10">
                  {["Bill #", "Name", "Mobile", "Order ₹", "Discount", "Tax", "Total ₹", "Payment", "Date & Time", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {bills.map((b) => (
                    <tr key={b.id} className="border-b border-amber-900/5 hover:bg-[#8B5A2B]/5" data-testid={`eb-row-${b.id}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#2C241B]">{b.bill_number}</td>
                      <td className="px-4 py-3 text-[#2C241B]">{b.customer_name}</td>
                      <td className="px-4 py-3 text-[#8A7D71] text-xs">{b.customer_phone || "—"}</td>
                      <td className="px-4 py-3 text-[#5C4F43]">₹{(b.subtotal || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-[#B84B4B]">{b.overall_discount > 0 ? `−₹${b.overall_discount.toFixed(2)}` : "0"}</td>
                      <td className="px-4 py-3 text-[#5C4F43] text-xs">₹{((b.cgst || 0) + (b.sgst || 0)).toFixed(2)}</td>
                      <td className="px-4 py-3 font-bold text-[#8B5A2B]">₹{(b.total || 0).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-[#8B5A2B]/10 text-[#8B5A2B] px-2 py-0.5 rounded-full font-medium">
                          {b.payment_mode === "cash+upi" ? "Split" : b.payment_mode?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#8A7D71] text-xs whitespace-nowrap">{fmtDateTime(b.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setShowBill(b)} title="View"
                            className="text-[#8A7D71] hover:text-[#5C4F43]" data-testid={`view-eb-${b.id}`}>
                            <Eye size={14} />
                          </button>
                          <button onClick={() => setEditBill(b)} title="Edit"
                            className="text-[#8A7D71] hover:text-[#8B5A2B]" data-testid={`edit-eb-${b.id}`}>
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => printBill(b)} title="Print Bill"
                            className="text-[#8A7D71] hover:text-[#8B5A2B]" data-testid={`print-bill-${b.id}`}>
                            <Printer size={14} />
                          </button>
                          <button onClick={() => printKot(b)} title="Print KOT"
                            className="text-[#8A7D71] hover:text-[#3E5C46]" data-testid={`print-kot-${b.id}`}>
                            <ChefHat size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {showBill && <ViewModal bill={showBill} onClose={() => setShowBill(null)} />}
      {editBill && <EditModal bill={editBill} onClose={() => setEditBill(null)}
        onSaved={(updated) => { setBills((p) => p.map((b) => b.id === updated.id ? updated : b)); setEditBill(null); }} />}
    </div>
  );
}

function ViewModal({ bill, onClose }) {
  return (
    <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl slide-up">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>{bill.bill_number}</h2>
            <p className="text-xs text-[#8A7D71]">{bill.customer_name} · {fmtDateTime(bill.created_at)}</p>
          </div>
          <button onClick={onClose} className="text-[#8A7D71]"><X size={18} /></button>
        </div>
        <div className="space-y-2 mb-4">
          {(bill.items || []).map((it, i) => (
            <div key={i} className="flex justify-between text-sm bg-[#F6F3EC] rounded-xl p-2">
              <span className="text-[#2C241B]">{it.name} × {it.quantity}</span>
              <span className="text-[#8B5A2B] font-semibold">₹{(it.subtotal || 0).toFixed(0)}</span>
            </div>
          ))}
        </div>
        <div className="bg-[#F6F3EC] rounded-xl p-3 space-y-1 text-sm mb-4">
          <div className="flex justify-between"><span>Subtotal</span><span>₹{(bill.subtotal || 0).toFixed(2)}</span></div>
          {bill.overall_discount > 0 && <div className="flex justify-between text-[#B84B4B]"><span>Discount</span><span>−₹{bill.overall_discount.toFixed(2)}</span></div>}
          <div className="flex justify-between"><span>CGST (2.5%)</span><span>₹{(bill.cgst || 0).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>SGST (2.5%)</span><span>₹{(bill.sgst || 0).toFixed(2)}</span></div>
          {bill.service_charge_enabled && (
            <div className="flex justify-between"><span>Service Charge (5%)</span><span>₹{(bill.service_charge || 0).toFixed(2)}</span></div>
          )}
          {typeof bill.round_off === "number" && Math.abs(bill.round_off) > 0.001 && (
            <div className="flex justify-between text-[#8A7D71]"><span>Round Off</span><span>{bill.round_off >= 0 ? "+" : "−"}₹{Math.abs(bill.round_off).toFixed(2)}</span></div>
          )}
          <div className="flex justify-between font-bold text-[#8B5A2B] pt-1 border-t border-amber-900/10"><span>Total</span><span>₹{(bill.total || 0).toFixed(2)}</span></div>
        </div>
        {(bill.inventory_deductions || []).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#5C4F43] mb-1.5">Inventory Deducted</p>
            <div className="flex flex-wrap gap-1">
              {bill.inventory_deductions.map((d, i) => (
                <span key={i} className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full">
                  −{d.quantity_deducted} {d.unit} {d.item_name}
                </span>
              ))}
            </div>
          </div>
        )}
        {bill.last_edited_at && (
          <p className="mt-3 text-[10px] text-[#8A7D71] italic">Last edited: {fmtDateTime(bill.last_edited_at)}</p>
        )}
      </div>
    </div>
  );
}

function EditModal({ bill, onClose, onSaved }) {
  const [customerName, setCustomerName] = useState(bill.customer_name || "");
  const [customerPhone, setCustomerPhone] = useState(bill.customer_phone || "");
  const [items, setItems] = useState((bill.items || []).map((i) => ({
    menu_item_id: i.menu_item_id, name: i.name, price: i.price,
    quantity: i.quantity, item_discount_pct: i.item_discount_pct || 0,
  })));
  const [overallDisc, setOverallDisc] = useState(bill.overall_discount || 0);
  const [paymentMode, setPaymentMode] = useState(bill.payment_mode || "cash");
  const [cashAmount, setCashAmount] = useState(bill.cash_amount || 0);
  const [upiAmount, setUpiAmount] = useState(bill.upi_amount || 0);
  const [serviceCharge, setServiceCharge] = useState(!!bill.service_charge_enabled);
  const [saving, setSaving] = useState(false);

  const lines = items.map((it) => {
    const gross = it.price * it.quantity;
    const disc = gross * (it.item_discount_pct || 0) / 100;
    return { ...it, gross, itemDisc: disc, subtotal: gross - disc };
  });
  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  const disc = parseFloat(overallDisc) || 0;
  const taxable = Math.max(0, subtotal - disc);
  const cgst = taxable * TAX;
  const sgst = taxable * TAX;
  const service = serviceCharge ? taxable * SERVICE_RATE : 0;
  const rawTotal = taxable + cgst + sgst + service;
  const total = Math.round(rawTotal);
  const roundOff = total - rawTotal;

  const adj = (idx, field, val) => setItems((p) => {
    const list = [...p];
    const num = ["quantity", "price", "item_discount_pct"].includes(field) ? Math.max(0, parseFloat(val) || 0) : val;
    list[idx] = { ...list[idx], [field]: num };
    return list;
  });
  const removeItem = (idx) => setItems((p) => p.filter((_, i) => i !== idx));

  const save = async () => {
    if (!customerName.trim()) { toast.error("Customer name required"); return; }
    if (items.length === 0) { toast.error("At least one item required"); return; }
    setSaving(true);
    try {
      const cash = paymentMode === "cash" ? total : paymentMode === "upi" ? 0 : parseFloat(cashAmount) || 0;
      const upi = paymentMode === "upi" ? total : paymentMode === "cash" ? 0 : parseFloat(upiAmount) || 0;
      const { data } = await api.put(`/bills/${bill.id}`, {
        customer_name: customerName,
        customer_phone: customerPhone || null,
        items: items.map((i) => ({ ...i, quantity: parseInt(i.quantity) || 1 })),
        overall_discount: disc,
        payment_mode: paymentMode,
        cash_amount: cash, upi_amount: upi,
        service_charge_enabled: serviceCharge,
      });
      onSaved(data);
      toast.success(`${data.bill_number} updated · inventory rebalanced`);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl slide-up">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Edit · {bill.bill_number}</h2>
            <p className="text-xs text-[#8A7D71]">All fields editable. Inventory is reversed & re-applied on save.</p>
          </div>
          <button onClick={onClose} className="text-[#8A7D71]"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-[#5C4F43] font-medium">Customer Name *</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
              className="w-full mt-1 rounded-lg border border-amber-900/20 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
              data-testid="edit-bill-name" />
          </div>
          <div>
            <label className="text-xs text-[#5C4F43] font-medium">Mobile</label>
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full mt-1 rounded-lg border border-amber-900/20 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
              data-testid="edit-bill-phone" />
          </div>
        </div>

        <div className="mb-3">
          <label className="text-xs text-[#5C4F43] font-medium mb-2 block">Items</label>
          <div className="space-y-2">
            {lines.map((it, idx) => (
              <div key={idx} className="bg-[#F6F3EC] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <input value={it.name} onChange={(e) => adj(idx, "name", e.target.value)}
                    className="flex-1 rounded-lg border border-amber-900/20 bg-white px-2 py-1 text-sm focus:outline-none focus:border-[#8B5A2B]"
                    data-testid={`edit-item-name-${idx}`} />
                  <button onClick={() => removeItem(idx)} className="text-[#B84B4B] hover:opacity-80 p-1"
                    data-testid={`remove-item-${idx}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-[#8A7D71]">Price</label>
                    <input type="number" step="0.01" value={it.price} onChange={(e) => adj(idx, "price", e.target.value)}
                      className="w-full rounded-lg border border-amber-900/20 bg-white px-2 py-1 text-sm focus:outline-none focus:border-[#8B5A2B]"
                      data-testid={`edit-item-price-${idx}`} />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8A7D71]">Qty</label>
                    <div className="flex items-center gap-1 mt-0.5">
                      <button onClick={() => adj(idx, "quantity", it.quantity - 1)} className="w-6 h-6 rounded bg-white border border-amber-900/20 flex items-center justify-center"><Minus size={10} /></button>
                      <input type="number" min="0" value={it.quantity} onChange={(e) => adj(idx, "quantity", e.target.value)}
                        className="w-12 rounded border border-amber-900/20 bg-white px-1 py-0.5 text-sm text-center focus:outline-none focus:border-[#8B5A2B]"
                        data-testid={`edit-item-qty-${idx}`} />
                      <button onClick={() => adj(idx, "quantity", it.quantity + 1)} className="w-6 h-6 rounded bg-white border border-amber-900/20 flex items-center justify-center"><Plus size={10} /></button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8A7D71]">Disc %</label>
                    <input type="number" min="0" max="100" value={it.item_discount_pct}
                      onChange={(e) => adj(idx, "item_discount_pct", e.target.value)}
                      className="w-full rounded-lg border border-amber-900/20 bg-white px-2 py-1 text-sm focus:outline-none focus:border-[#8B5A2B]" />
                  </div>
                  <div className="text-right">
                    <label className="text-[10px] text-[#8A7D71]">Subtotal</label>
                    <p className="text-sm font-semibold text-[#8B5A2B] mt-0.5">₹{it.subtotal.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#F6F3EC] rounded-xl p-3 mb-3 space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <label className="w-28 text-[#5C4F43]">Overall Discount (₹)</label>
            <input type="number" step="0.01" value={overallDisc} onChange={(e) => setOverallDisc(e.target.value)}
              className="flex-1 rounded border border-amber-900/20 bg-white px-2 py-1 text-sm focus:outline-none focus:border-[#8B5A2B]"
              data-testid="edit-overall-disc" />
          </div>
          <div className="flex justify-between pt-1"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Taxable</span><span>₹{taxable.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>CGST (2.5%)</span><span>₹{cgst.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>SGST (2.5%)</span><span>₹{sgst.toFixed(2)}</span></div>
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={serviceCharge} onChange={(e) => setServiceCharge(e.target.checked)}
                className="rounded" data-testid="edit-service-charge-toggle" />
              <span className="text-[#5C4F43]">Service Charge (5%)</span>
            </label>
            <span>{serviceCharge ? `₹${service.toFixed(2)}` : "—"}</span>
          </div>
          <div className="flex justify-between text-[#8A7D71]"><span>Round Off</span><span>{roundOff >= 0 ? "+" : "−"}₹{Math.abs(roundOff).toFixed(2)}</span></div>
          <div className="flex justify-between font-bold text-[#8B5A2B] pt-1 border-t border-amber-900/10"><span>Total</span><span>₹{total}</span></div>
        </div>

        <div className="mb-3">
          <label className="text-xs text-[#5C4F43] font-medium mb-1 block">Payment Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {["cash", "upi", "cash+upi"].map((m) => (
              <button key={m} onClick={() => setPaymentMode(m)}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${paymentMode === m ? "bg-[#8B5A2B] text-white" : "bg-[#F6F3EC] text-[#5C4F43] hover:bg-[#8B5A2B]/10"}`}
                data-testid={`edit-pay-${m}`}>
                {m === "cash+upi" ? "Split" : m.toUpperCase()}
              </button>
            ))}
          </div>
          {paymentMode === "cash+upi" && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input type="number" value={cashAmount} placeholder="Cash" onChange={(e) => setCashAmount(e.target.value)}
                className="rounded-lg border border-amber-900/20 px-2 py-1.5 text-sm focus:outline-none focus:border-[#8B5A2B]" />
              <input type="number" value={upiAmount} placeholder="UPI" onChange={(e) => setUpiAmount(e.target.value)}
                className="rounded-lg border border-amber-900/20 px-2 py-1.5 text-sm focus:outline-none focus:border-[#8B5A2B]" />
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold disabled:opacity-50"
            data-testid="save-edit-bill-btn">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
