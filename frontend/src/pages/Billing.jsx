import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, Trash2, RefreshCw } from "lucide-react";

export default function Billing() {
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [cashAmount, setCashAmount] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  const [category, setCategory] = useState("All");
  const [submitting, setSubmitting] = useState(false);
  const [lastBill, setLastBill] = useState(null);

  useEffect(() => {
    api.get("/menu?active_only=true")
      .then((r) => setMenuItems(r.data))
      .catch(() => toast.error("Failed to load menu"));
  }, []);

  const categories = ["All", ...new Set(menuItems.map((i) => i.category))];
  const filtered = category === "All"
    ? menuItems.filter((i) => i.active)
    : menuItems.filter((i) => i.category === category && i.active);

  const total = cart.reduce((s, c) => s + c.subtotal, 0);
  const cartQty = cart.reduce((s, c) => s + c.qty, 0);

  const addToCart = (item) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === item.id);
      if (ex) return prev.map((c) => c.id === item.id ? { ...c, qty: c.qty + 1, subtotal: c.price * (c.qty + 1) } : c);
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, subtotal: item.price }];
    });
  };

  const adjustQty = (id, delta) => {
    setCart((prev) => {
      const item = prev.find((c) => c.id === id);
      if (item.qty + delta <= 0) return prev.filter((c) => c.id !== id);
      return prev.map((c) => c.id === id ? { ...c, qty: c.qty + delta, subtotal: c.price * (c.qty + delta) } : c);
    });
  };

  const isPaymentValid = () => {
    if (paymentMode !== "cash+upi") return true;
    const c = parseFloat(cashAmount) || 0;
    const u = parseFloat(upiAmount) || 0;
    return Math.abs(c + u - total) < 0.01;
  };

  const handleSubmit = async () => {
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
        items: cart.map((c) => ({ menu_item_id: c.id, name: c.name, price: c.price, quantity: c.qty, subtotal: c.subtotal })),
        payment_mode: paymentMode,
        cash_amount: cash,
        upi_amount: upi,
      });
      setLastBill(data);
      setCart([]); setCustomerName(""); setCustomerPhone("");
      setPaymentMode("cash"); setCashAmount(""); setUpiAmount("");
      toast.success(`Bill ${data.bill_number} created!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create bill");
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }} className="h-[calc(100vh-48px)] flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Billing</h1>
          <p className="text-[#8A7D71] text-sm mt-0.5">Point of Sale</p>
        </div>
        {lastBill && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-sm text-green-700 font-medium">
            Last: {lastBill.bill_number} — ₹{lastBill.total}
          </div>
        )}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* LEFT: Menu */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Category tabs */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  category === cat ? "bg-[#8B5A2B] text-white" : "bg-white border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"
                }`}
                data-testid={`category-tab-${cat.toLowerCase().replace(/\s+/g, "-")}`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Items grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto flex-1 pb-2">
            {filtered.length === 0 ? (
              <div className="col-span-full text-center text-[#8A7D71] py-10 text-sm">No items — add some from Menu page</div>
            ) : filtered.map((item) => {
              const inCart = cart.find((c) => c.id === item.id);
              return (
                <button key={item.id} onClick={() => addToCart(item)}
                  className={`bg-white rounded-2xl border p-4 text-left hover:shadow-md transition-all active:scale-[0.97] shadow-[0_2px_8px_rgba(44,36,27,0.04)] relative ${
                    inCart ? "border-[#8B5A2B]/40 bg-[#8B5A2B]/5" : "border-amber-900/10 hover:border-[#8B5A2B]/30"
                  }`}
                  data-testid={`menu-item-${item.id}`}>
                  {inCart && (
                    <span className="absolute top-2 right-2 bg-[#8B5A2B] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                      {inCart.qty}
                    </span>
                  )}
                  <p className="font-semibold text-[#2C241B] text-sm leading-tight">{item.name}</p>
                  <p className="text-[10px] text-[#8A7D71] mt-0.5">{item.category}</p>
                  <p className="text-[#8B5A2B] font-bold mt-2">₹{item.price}</p>
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
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
                className="w-full mt-1 rounded-lg border border-amber-900/20 bg-white px-3 py-2 text-sm text-[#2C241B] focus:outline-none focus:border-[#8B5A2B]"
                data-testid="billing-customer-name" />
            </div>
            <div>
              <label className="text-xs text-[#8A7D71] font-medium">Phone (optional)</label>
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full mt-1 rounded-lg border border-amber-900/20 bg-white px-3 py-2 text-sm text-[#2C241B] focus:outline-none focus:border-[#8B5A2B]"
                data-testid="billing-customer-phone" />
            </div>
          </div>

          {/* Cart header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/10">
            <div className="flex items-center gap-2 text-[#2C241B] text-sm font-semibold">
              <ShoppingCart size={15} /> Cart {cartQty > 0 ? `(${cartQty})` : ""}
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-[#B84B4B] hover:underline flex items-center gap-1"
                data-testid="clear-cart-btn">
                <Trash2 size={11} /> Clear
              </button>
            )}
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center text-[#8A7D71] text-sm py-8">Tap items to add</div>
            ) : cart.map((item) => (
              <div key={item.id} className="flex items-center gap-2 bg-[#F6F3EC] rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#2C241B] truncate">{item.name}</p>
                  <p className="text-xs text-[#8A7D71]">₹{item.price} × {item.qty}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => adjustQty(item.id, -1)}
                    className="w-6 h-6 rounded-full bg-white border border-amber-900/20 flex items-center justify-center hover:bg-red-50 text-[#2C241B] transition-colors"
                    data-testid={`decrease-qty-${item.id}`}>
                    <Minus size={10} />
                  </button>
                  <span className="w-5 text-center text-sm font-bold text-[#2C241B]">{item.qty}</span>
                  <button onClick={() => adjustQty(item.id, 1)}
                    className="w-6 h-6 rounded-full bg-white border border-amber-900/20 flex items-center justify-center hover:bg-green-50 text-[#2C241B] transition-colors"
                    data-testid={`increase-qty-${item.id}`}>
                    <Plus size={10} />
                  </button>
                </div>
                <span className="text-sm font-bold text-[#8B5A2B] w-14 text-right">₹{item.subtotal}</span>
              </div>
            ))}
          </div>

          {/* Payment */}
          <div className="p-4 border-t border-amber-900/10 space-y-3">
            <div>
              <p className="text-xs text-[#8A7D71] font-medium mb-2">Payment Mode</p>
              <div className="grid grid-cols-3 gap-1.5">
                {["cash", "upi", "cash+upi"].map((mode) => (
                  <button key={mode} onClick={() => setPaymentMode(mode)}
                    className={`py-2 rounded-xl text-xs font-semibold transition-colors ${
                      paymentMode === mode ? "bg-[#8B5A2B] text-white" : "bg-[#F6F3EC] text-[#5C4F43] hover:bg-[#8B5A2B]/10"
                    }`}
                    data-testid={`payment-mode-${mode}`}>
                    {mode === "cash+upi" ? "Cash+UPI" : mode.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {paymentMode === "cash+upi" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-[#8A7D71]">Cash (₹)</label>
                  <input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)}
                    placeholder="0"
                    className="w-full mt-1 rounded-lg border border-amber-900/20 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                    data-testid="cash-amount-input" />
                </div>
                <div>
                  <label className="text-xs text-[#8A7D71]">UPI (₹)</label>
                  <input type="number" value={upiAmount} onChange={(e) => setUpiAmount(e.target.value)}
                    placeholder="0"
                    className="w-full mt-1 rounded-lg border border-amber-900/20 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                    data-testid="upi-amount-input" />
                </div>
                {cashAmount && upiAmount && !isPaymentValid() && (
                  <p className="col-span-2 text-xs text-red-500">Must equal ₹{total.toFixed(2)}</p>
                )}
              </div>
            )}

            <div className="flex justify-between items-center py-2 border-t border-amber-900/10">
              <span className="font-bold text-[#2C241B]">Total</span>
              <span className="text-2xl font-bold text-[#8B5A2B]" style={{ fontFamily: "Outfit, sans-serif" }}>
                ₹{total.toFixed(2)}
              </span>
            </div>

            <button onClick={handleSubmit} disabled={submitting || cart.length === 0}
              className="w-full bg-[#8B5A2B] text-white rounded-xl py-3 font-bold text-sm hover:bg-[#704822] active:scale-[0.98] transition-all disabled:opacity-50"
              data-testid="submit-bill-btn">
              {submitting ? "Processing..." : `Submit Bill  ₹${total.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
