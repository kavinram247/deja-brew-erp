import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Receipt, Ban, ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import ThemeDatePicker from "../../components/ThemeDatePicker";

function fmt(iso) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export default function EntryBills() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBill, setShowBill] = useState(null);
  const [voidingId, setVoidingId] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState("");

  const load = async (d = date) => {
    setLoading(true);
    try { const { data } = await api.get(`/bills?date_str=${d}`); setBills(data); }
    catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(date); }, [date]); // eslint-disable-line

  const changeDate = (delta) => {
    const dt = new Date(date + "T00:00:00"); dt.setDate(dt.getDate() + delta);
    setDate(dt.toISOString().split("T")[0]);
  };

  const confirmVoid = async () => {
    if (!voidTarget) return;
    setVoidingId(voidTarget.id);
    try {
      const { data } = await api.post(`/bills/${voidTarget.id}/void`);
      setBills((p) => p.map((b) => b.id === voidTarget.id ? data : b));
      toast.success(`Bill ${voidTarget.bill_number} voided · inventory restored`);
      setVoidTarget(null); setVoidReason("");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setVoidingId(null); }
  };

  const active = bills.filter((b) => !b.is_voided);
  const voided = bills.filter((b) => b.is_voided);
  const totalRev = active.reduce((s, b) => s + b.total, 0);
  const voidedTotal = voided.reduce((s, b) => s + b.total, 0);

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Bills</h1>
          <p className="text-[#8A7D71] text-sm mt-1">View & void bills · {date === today ? "Today" : date}</p>
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
          { label: "Active Bills", value: active.length, color: "#3E5C46", testid: "eb-active" },
          { label: "Revenue", value: `₹${totalRev.toLocaleString("en-IN")}`, color: "#8B5A2B", testid: "eb-revenue" },
          { label: "Voided", value: voided.length, color: "#B84B4B", testid: "eb-voided" },
          { label: "Voided ₹", value: `₹${voidedTotal.toLocaleString("en-IN")}`, color: "#C06C4C", testid: "eb-voided-amt" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid={s.testid}>
            <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color, fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        <div className="px-5 py-4 border-b border-amber-900/10 flex items-center justify-between">
          <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
            {bills.length} bill{bills.length !== 1 ? "s" : ""}
          </h2>
          <span className="text-xs text-[#8A7D71]">Voiding restores inventory automatically</span>
        </div>
        {loading ? <div className="text-center text-[#8A7D71] py-10">Loading...</div>
          : bills.length === 0 ? (
            <div className="text-center py-12">
              <Receipt size={36} className="text-[#C9B99A] mx-auto mb-2" />
              <p className="text-[#8A7D71] text-sm">No bills on this date</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-amber-900/10">
                  {["Bill #", "Time", "Customer", "Items", "Payment", "Total", "Status", ""].map((h) => (
                    <th key={h} className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {bills.map((b) => (
                    <tr key={b.id} className={`border-b border-amber-900/5 hover:bg-[#8B5A2B]/5 ${b.is_voided ? "opacity-50" : ""}`}
                      data-testid={`ebill-row-${b.id}`}>
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-[#2C241B]">{b.bill_number}</td>
                      <td className="px-5 py-3 text-[#8A7D71]">{fmt(b.created_at)}</td>
                      <td className="px-5 py-3 text-[#2C241B]">{b.customer_name}</td>
                      <td className="px-5 py-3 text-[#8A7D71]">{b.items?.length || 0}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-[#8B5A2B]/10 text-[#8B5A2B] px-2 py-0.5 rounded-full font-medium">
                          {b.payment_mode === "cash+upi" ? "Split" : b.payment_mode?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-bold text-[#8B5A2B]">₹{b.total?.toFixed(2)}</td>
                      <td className="px-5 py-3">
                        {b.is_voided
                          ? <span className="inline-flex px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">Voided</span>
                          : <span className="inline-flex px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">Active</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setShowBill(b)} className="text-[#8A7D71] hover:text-[#5C4F43]" data-testid={`view-ebill-${b.id}`}>
                            <Eye size={14} />
                          </button>
                          {!b.is_voided && (
                            <button onClick={() => setVoidTarget(b)} disabled={voidingId === b.id}
                              className="flex items-center gap-1 text-xs text-[#B84B4B] hover:underline font-medium disabled:opacity-50"
                              data-testid={`void-ebill-${b.id}`}>
                              <Ban size={12} /> {voidingId === b.id ? "Voiding..." : "Void"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Detail Modal */}
      {showBill && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl slide-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>{showBill.bill_number}</h2>
                <p className="text-xs text-[#8A7D71]">{showBill.customer_name} · {fmt(showBill.created_at)}</p>
              </div>
              <button onClick={() => setShowBill(null)} className="text-[#8A7D71]"><X size={18} /></button>
            </div>

            <div className="space-y-2 mb-4">
              {(showBill.items || []).map((it, i) => (
                <div key={i} className="flex justify-between text-sm bg-[#F6F3EC] rounded-xl p-2">
                  <span className="text-[#2C241B]">{it.name} × {it.quantity}</span>
                  <span className="text-[#8B5A2B] font-semibold">₹{it.subtotal?.toFixed(0)}</span>
                </div>
              ))}
            </div>

            <div className="bg-[#F6F3EC] rounded-xl p-3 space-y-1 text-sm mb-4">
              <div className="flex justify-between"><span>Subtotal</span><span>₹{showBill.subtotal?.toFixed(2)}</span></div>
              {showBill.overall_discount > 0 && <div className="flex justify-between text-[#B84B4B]"><span>Discount</span><span>−₹{showBill.overall_discount?.toFixed(2)}</span></div>}
              <div className="flex justify-between"><span>CGST (2.5%)</span><span>₹{showBill.cgst?.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>SGST (2.5%)</span><span>₹{showBill.sgst?.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-[#8B5A2B] pt-1 border-t border-amber-900/10"><span>Total</span><span>₹{showBill.total?.toFixed(2)}</span></div>
            </div>

            {showBill.is_voided && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-2 text-xs text-red-700">
                <strong>Voided</strong> — inventory restored.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Void Confirmation */}
      {voidTarget && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#B84B4B] flex items-center justify-center">
                <Ban size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Void Bill?</h2>
                <p className="text-xs text-[#8A7D71]">{voidTarget.bill_number} · ₹{voidTarget.total?.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-sm text-[#5C4F43] mb-3">This action cannot be undone. Inventory will be restored and the bill will be marked as Voided.</p>
            {(voidTarget.inventory_deductions || []).length > 0 && (
              <div className="bg-[#F6F3EC] rounded-xl p-3 mb-3 space-y-1">
                <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest font-semibold mb-1">Will restore:</p>
                {voidTarget.inventory_deductions.map((d, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-[#5C4F43]">{d.item_name}</span>
                    <span className="font-semibold text-[#3E5C46]">+{d.quantity_deducted} {d.unit}</span>
                  </div>
                ))}
              </div>
            )}
            <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason (optional)"
              className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm mb-4 focus:outline-none focus:border-[#8B5A2B]"
              data-testid="void-reason" />
            <div className="flex gap-2">
              <button onClick={() => { setVoidTarget(null); setVoidReason(""); }}
                className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
              <button onClick={confirmVoid} disabled={voidingId}
                className="flex-1 py-2 rounded-xl bg-[#B84B4B] text-white text-sm font-semibold hover:bg-[#9A3E3E] disabled:opacity-50"
                data-testid="confirm-void-btn">
                {voidingId ? "Voiding..." : "Confirm Void"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
