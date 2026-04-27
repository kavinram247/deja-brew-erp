import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, Trash2, Printer, ChefHat } from "lucide-react";
import { usePrint } from "../../components/usePrint";

const TAX = 0.025;

export default function Billing() {
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [overallDisc, setOverallDisc] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [cashAmount, setCashAmount] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  const [category, setCategory] = useState("All");
  const [submitting, setSubmitting] = useState(false);
  const [lastBill, setLastBill] = useState(null);

  // Inline walk-in logging
  const [logWalkin, setLogWalkin] = useState(false);
  const [walkinGuests, setWalkinGuests] = useState(1);

  const { printBill, printKot, PrintHost } = usePrint();

  useEffect(() => {
    api.get("/menu?active_only=true").then((r) => setMenuItems(r.data)).catch(() => toast.error("Failed to load menu"));
  }, []);

  const categories = ["All", ...new Set(menuItems.map((i) => i.category))];
  const filtered = category === "All" ? menuItems.filter((i) => i.active) : menuItems.filter((i) => i.category === category && i.active);

  const addToCart = (item) => {
    setCart((p) => {
      const ex = p.find((c) => c.id === item.id);
      if (ex) return p.map((c) => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...p, { id: item.id, name: item.name, price: item.price, qty: 1, discPct: 0 }];
    });
  };

  const adjustQty = (id, d) => {
    setCart((p) => {
      const item = p.find((c) => c.id === id);
      if (item.qty + d <= 0) return p.filter((c) => c.id !== id);
      return p.map((c) => c.id === id ? { ...c, qty: c.qty + d } : c);
    });
  };

  const setDisc = (id, val) => setCart((p) => p.map((c) => c.id === id ? { ...c, discPct: Math.min(100, Math.max(0, parseFloat(val) || 0)) } : c));

  const cartLines = cart.map((c) => ({ ...c, gross: c.price * c.qty, itemDisc: c.price * c.qty * c.discPct / 100, subtotal: c.price * c.qty * (1 - c.discPct / 100) }));
  const subtotal = cartLines.reduce((s, c) => s + c.subtotal, 0);
  const disc = parseFloat(overallDisc) || 0;
  const taxable = Math.max(0, subtotal - disc);
  const cgst = taxable * TAX;
  const sgst = taxable * TAX;
  const total = taxable + cgst + sgst;

  const isPaymentValid = () => {
    if (paymentMode !== "cash+upi") return true;
    return Math.abs((parseFloat(cashAmount) || 0) + (parseFloat(upiAmount) || 0) - total) < 0.5;
  };

  const handleSubmit = async (printAfter = null) => {
    if (!customerName.trim()) { toast.error("Enter customer name"); return; }
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (!isPaymentValid()) { toast.error(`Cash + UPI must equal ₹${total.toFixed(2)}`); return; }
    setSubmitting(true);
    try {
      const cash = paymentMode === "cash" ? total : paymentMode === "upi" ? 0 : parseFloat(cashAmount) || 0;
      const upi = paymentMode === "upi" ? total : paymentMode === "cash" ? 0 : parseFloat(upiAmount) || 0;
      const { data } = await api.post("/bills", {
        customer_name: customerName,
        customer_phone: customerPhone || null,
        items: cartLines.map((c) => ({ menu_item_id: c.id, name: c.name, price: c.price, quantity: c.qty, item_discount_pct: c.discPct })),
        overall_discount: disc,
        payment_mode: paymentMode,
        cash_amount: cash, upi_amount: upi,
      });
      setLastBill(data);
      // Optionally log walk-in silently
      if (logWalkin) {
        try {
          await api.post("/walkins", {
            num_guests: parseInt(walkinGuests) || 1,
            payment_mode: paymentMode === "cash+upi" ? "split" : paymentMode,
            notes: `Auto-logged with bill ${data.bill_number}`,
          });
        } catch (_) { /* non-blocking */ }
      }
      setCart([]); setCustomerName(""); setCustomerPhone(""); setOverallDisc(""); setPaymentMode("cash"); setCashAmount(""); setUpiAmount("");
      setLogWalkin(false); setWalkinGuests(1);
      toast.success(`Bill ${data.bill_number} — ₹${data.total.toFixed(2)}${logWalkin ? " · walk-in logged" : ""}`);
      if (printAfter === "bill") {
        // Print bill, then KOT shortly after so two print dialogs queue cleanly
        printBill(data);
        setTimeout(() => printKot(data), 700);
      }
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }} className="h-[calc(100vh-48px)] flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Billing</h1>
          {lastBill && <p className="text-xs text-green-600 mt-0.5">Last: {lastBill.bill_number} · ₹{lastBill.total?.toFixed(2)}</p>}
        </div>
        {lastBill && (
          <div className="flex items-center gap-2">
            <button onClick={() => printKot(lastBill)}
              className="flex items-center gap-1.5 bg-[#3E5C46] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#2F4735]"
              data-testid="print-kot-btn">
              <ChefHat size={14} /> Print KOT
            </button>
            <button onClick={() => printBill(lastBill)}
              className="flex items-center gap-1.5 bg-[#8B5A2B] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#704822]"
              data-testid="print-bill-btn">
              <Printer size={14} /> Print Bill
            </button>
          </div>
        )}
      </div>
      <PrintHost />

      <div className="flex gap-4 flex-1 min-h-0">
        {/* LEFT: Menu */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex gap-2 mb-3 flex-wrap">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${category === cat ? "bg-[#8B5A2B] text-white" : "bg-white border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"}`}
                data-testid={`cat-${cat.toLowerCase().replace(/\s+/g, "-")}`}>{cat}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 overflow-y-auto flex-1 pb-2">
            {filtered.length === 0 ? (
              <div className="col-span-full text-center text-[#8A7D71] py-10 text-sm">No items — add from Menu</div>
            ) : filtered.map((item) => {
              const inCart = cart.find((c) => c.id === item.id);
              return (
                <button key={item.id} onClick={() => addToCart(item)}
                  className={`bg-white rounded-xl border p-2 text-left hover:shadow-md transition-all active:scale-[0.97] shadow-[0_2px_6px_rgba(44,36,27,0.04)] relative ${inCart ? "border-[#8B5A2B]/40 bg-[#8B5A2B]/5" : "border-amber-900/10"}`}
                  data-testid={`menu-item-${item.id}`}>
                  {inCart && <span className="absolute top-1 right-1 bg-[#8B5A2B] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{inCart.qty}</span>}
                  <p className="font-semibold text-[#2C241B] text-xs leading-tight line-clamp-2">{item.name}</p>
                  <p className="text-[#8B5A2B] font-bold text-xs mt-1">₹{item.price}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Cart */}
        <div className="w-80 xl:w-96 flex flex-col bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.06)] overflow-hidden">
          {/* Customer */}
          <div className="p-4 bg-[#F6F3EC] border-b border-amber-900/10 space-y-2">
            <div>
              <label className="text-xs text-[#8A7D71] font-medium">Customer Name *</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name"
                className="w-full mt-1 rounded-lg border border-amber-900/20 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                data-testid="billing-customer-name" />
            </div>
            <div>
              <label className="text-xs text-[#8A7D71] font-medium">Phone (optional)</label>
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+91 ..."
                className="w-full mt-1 rounded-lg border border-amber-900/20 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                data-testid="billing-customer-phone" />
            </div>
            {/* Inline walk-in logging */}
            <div className="pt-1 border-t border-amber-900/15">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={logWalkin} onChange={(e) => setLogWalkin(e.target.checked)}
                  className="rounded" data-testid="billing-log-walkin-toggle" />
                <span className="text-xs font-medium text-[#5C4F43]">Also log as walk-in</span>
              </label>
              {logWalkin && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-[#8A7D71]">Guests</label>
                  <input type="number" min="1" value={walkinGuests}
                    onChange={(e) => setWalkinGuests(e.target.value)}
                    className="w-16 rounded-lg border border-amber-900/20 bg-white px-2 py-1 text-sm focus:outline-none focus:border-[#8B5A2B] text-center"
                    data-testid="billing-walkin-guests" />
                  <span className="text-[10px] text-[#8A7D71]">Posted when bill is submitted</span>
                </div>
              )}
            </div>
          </div>

          {/* Cart header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-900/10">
            <span className="flex items-center gap-2 text-sm font-semibold text-[#2C241B]"><ShoppingCart size={14} /> Cart ({cart.reduce((s, c) => s + c.qty, 0)})</span>
            {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-[#B84B4B] hover:underline" data-testid="clear-cart-btn">Clear</button>}
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? <div className="text-center text-[#8A7D71] text-sm py-6">Tap items to add</div>
              : cartLines.map((item) => (
                <div key={item.id} className="bg-[#F6F3EC] rounded-xl p-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="flex-1 text-sm font-medium text-[#2C241B] truncate">{item.name}</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => adjustQty(item.id, -1)} className="w-6 h-6 rounded-full bg-white border border-amber-900/20 flex items-center justify-center hover:bg-red-50 text-[#2C241B]" data-testid={`dec-${item.id}`}><Minus size={10} /></button>
                      <span className="w-5 text-center text-sm font-bold text-[#2C241B]">{item.qty}</span>
                      <button onClick={() => adjustQty(item.id, 1)} className="w-6 h-6 rounded-full bg-white border border-amber-900/20 flex items-center justify-center hover:bg-green-50 text-[#2C241B]" data-testid={`inc-${item.id}`}><Plus size={10} /></button>
                    </div>
                    <span className="text-sm font-bold text-[#8B5A2B] w-14 text-right">₹{item.subtotal.toFixed(0)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[#8A7D71]">Discount %</label>
                    <input type="number" min="0" max="100" value={item.discPct || ""} onChange={(e) => setDisc(item.id, e.target.value)}
                      placeholder="0" className="w-14 rounded-lg border border-amber-900/20 bg-white px-2 py-0.5 text-xs focus:outline-none focus:border-[#8B5A2B] text-center" data-testid={`disc-${item.id}`} />
                    {item.discPct > 0 && <span className="text-xs text-[#B84B4B]">−₹{item.itemDisc.toFixed(0)}</span>}
                  </div>
                </div>
              ))}
          </div>

          {/* Bill summary + payment + actions — scrollable middle, fixed footer */}
          <div className="border-t border-amber-900/10 flex flex-col min-h-0">
            <div className="p-3 space-y-2 overflow-y-auto" style={{ maxHeight: "45vh" }}>
              {/* Overall discount */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#8A7D71] w-20 shrink-0">Overall Disc (₹)</label>
                <input type="number" step="0.01" value={overallDisc} onChange={(e) => setOverallDisc(e.target.value)} placeholder="0"
                  className="flex-1 rounded-lg border border-amber-900/20 px-3 py-1.5 text-sm focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="overall-discount-input" />
              </div>

              {/* Tax breakdown */}
              {cart.length > 0 && (
                <div className="bg-[#F6F3EC] rounded-xl p-2.5 space-y-0.5 text-xs">
                  <div className="flex justify-between text-[#5C4F43]"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                  {disc > 0 && <div className="flex justify-between text-[#B84B4B]"><span>Discount</span><span>−₹{disc.toFixed(2)}</span></div>}
                  <div className="flex justify-between text-[#5C4F43]"><span>Taxable</span><span>₹{taxable.toFixed(2)}</span></div>
                  <div className="flex justify-between text-[#5C4F43]"><span>CGST (2.5%)</span><span>₹{cgst.toFixed(2)}</span></div>
                  <div className="flex justify-between text-[#5C4F43]"><span>SGST (2.5%)</span><span>₹{sgst.toFixed(2)}</span></div>
                </div>
              )}

              {/* Payment mode */}
              <div>
                <p className="text-xs text-[#8A7D71] font-medium mb-1">Payment</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {["cash", "upi", "cash+upi"].map((m) => (
                    <button key={m} onClick={() => setPaymentMode(m)}
                      className={`py-1.5 rounded-xl text-xs font-semibold transition-colors ${paymentMode === m ? "bg-[#8B5A2B] text-white" : "bg-[#F6F3EC] text-[#5C4F43] hover:bg-[#8B5A2B]/10"}`}
                      data-testid={`pay-mode-${m}`}>
                      {m === "cash+upi" ? "Split" : m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMode === "cash+upi" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-[#8A7D71]">Cash (₹)</label>
                    <input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="0"
                      className="w-full mt-1 rounded-lg border border-amber-900/20 px-3 py-1.5 text-sm focus:outline-none focus:border-[#8B5A2B]" data-testid="cash-input" />
                  </div>
                  <div>
                    <label className="text-xs text-[#8A7D71]">UPI (₹)</label>
                    <input type="number" value={upiAmount} onChange={(e) => setUpiAmount(e.target.value)} placeholder="0"
                      className="w-full mt-1 rounded-lg border border-amber-900/20 px-3 py-1.5 text-sm focus:outline-none focus:border-[#8B5A2B]" data-testid="upi-input" />
                  </div>
                  {cashAmount && upiAmount && !isPaymentValid() && (
                    <p className="col-span-2 text-xs text-red-500">Must equal ₹{total.toFixed(2)}</p>
                  )}
                </div>
              )}
            </div>

            {/* Sticky footer: total + submit buttons */}
            <div className="p-3 border-t border-amber-900/10 bg-white space-y-2 shrink-0">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#2C241B] text-sm">Total</span>
                <span className="text-xl font-bold text-[#8B5A2B]" style={{ fontFamily: "Outfit, sans-serif" }}>₹{total.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleSubmit(null)} disabled={submitting || cart.length === 0}
                  className="bg-[#8B5A2B] text-white rounded-xl py-2.5 font-bold text-xs hover:bg-[#704822] active:scale-[0.98] transition-all disabled:opacity-50"
                  data-testid="submit-bill-btn">
                  {submitting ? "..." : "Submit Bill"}
                </button>
                <button onClick={() => handleSubmit("bill")} disabled={submitting || cart.length === 0}
                  className="flex items-center justify-center gap-1.5 bg-[#3E5C46] text-white rounded-xl py-2.5 text-xs font-bold hover:bg-[#2F4735] active:scale-[0.98] transition-all disabled:opacity-50"
                  data-testid="submit-print-bill-btn">
                  <Printer size={13} /> Submit + Print
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
