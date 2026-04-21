import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingBag, RefreshCw } from "lucide-react";

const PLATFORMS = ["swiggy", "zomato", "district"];
const PLT_COLORS = { swiggy: "#FF5A2C", zomato: "#CB202D", district: "#3E5C46" };
const PLT_BG = { swiggy: "#FFF0EB", zomato: "#FDECEA", district: "#EBF3EE" };

function fmt(iso) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

const EMPTY = { platform: "swiggy", gross_sales: "", net_sales: "", cash_amount: "", upi_amount: "", card_amount: "", notes: "" };

export default function OnlineSales() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/online-sales"); setEntries(data); }
    catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const platformTotals = {};
  PLATFORMS.forEach((p) => {
    const items = entries.filter((e) => e.platform === p);
    platformTotals[p] = { gross: items.reduce((s, e) => s + e.gross_sales, 0), net: items.reduce((s, e) => s + e.net_sales, 0), count: items.length };
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.gross_sales || !form.net_sales) { toast.error("Enter sales amounts"); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/online-sales", {
        platform: form.platform,
        gross_sales: parseFloat(form.gross_sales) || 0,
        net_sales: parseFloat(form.net_sales) || 0,
        cash_amount: parseFloat(form.cash_amount) || 0,
        upi_amount: parseFloat(form.upi_amount) || 0,
        card_amount: parseFloat(form.card_amount) || 0,
        notes: form.notes || null,
      });
      setEntries((p) => [data, ...p]);
      setForm(EMPTY); setShowForm(false);
      toast.success("Online sale recorded");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/online-sales/${id}`); setEntries((p) => p.filter((e) => e.id !== id)); toast.success("Deleted"); }
    catch { toast.error("Failed"); }
  };

  const totalNet = entries.reduce((s, e) => s + e.net_sales, 0);

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Online Sales</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Swiggy · Zomato · District</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"><RefreshCw size={16} /></button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#8B5A2B] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]"
            data-testid="add-online-sale-btn">
            <Plus size={16} /> Add Entry
          </button>
        </div>
      </div>

      {/* Platform summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {PLATFORMS.map((p) => (
          <div key={p} className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]"
            data-testid={`platform-card-${p}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: PLT_BG[p], color: PLT_COLORS[p] }}>
                {p.charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold text-[#2C241B] capitalize">{p}</span>
            </div>
            <p className="text-xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
              ₹{platformTotals[p].net.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-[#8A7D71] mt-1">Net · {platformTotals[p].count} entries</p>
          </div>
        ))}
      </div>

      {/* Total bar */}
      <div className="bg-[#8B5A2B]/10 border border-[#8B5A2B]/20 rounded-2xl p-4 mb-6 flex items-center justify-between">
        <span className="font-medium text-[#2C241B]">Today's Total Online Revenue</span>
        <span className="text-2xl font-bold text-[#8B5A2B]" style={{ fontFamily: "Outfit, sans-serif" }}>₹{totalNet.toLocaleString("en-IN")}</span>
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl slide-up">
            <h2 className="text-lg font-bold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Add Online Sale</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-2 block">Platform</label>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS.map((p) => (
                    <button key={p} type="button" onClick={() => setForm({ ...form, platform: p })}
                      className={`py-2 rounded-xl text-xs font-semibold transition-colors capitalize ${
                        form.platform === p ? "text-white" : "bg-[#F6F3EC] text-[#5C4F43] hover:bg-[#8B5A2B]/10"
                      }`}
                      style={form.platform === p ? { background: PLT_COLORS[p] } : {}}
                      data-testid={`platform-btn-${p}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Gross Sales (₹) *</label>
                  <input type="number" step="0.01" value={form.gross_sales}
                    onChange={(e) => setForm({ ...form, gross_sales: e.target.value })}
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                    data-testid="gross-sales-input" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Net Sales (₹) *</label>
                  <input type="number" step="0.01" value={form.net_sales}
                    onChange={(e) => setForm({ ...form, net_sales: e.target.value })}
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                    data-testid="net-sales-input" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Cash (₹)</label>
                  <input type="number" step="0.01" value={form.cash_amount}
                    onChange={(e) => setForm({ ...form, cash_amount: e.target.value })}
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">UPI (₹)</label>
                  <input type="number" step="0.01" value={form.upi_amount}
                    onChange={(e) => setForm({ ...form, upi_amount: e.target.value })}
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Notes</label>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional"
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold disabled:opacity-50"
                  data-testid="save-online-sale-btn">
                  {saving ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Entries list */}
      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        <div className="px-5 py-4 border-b border-amber-900/10">
          <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Today's Entries</h2>
        </div>
        {loading ? <div className="text-center py-10 text-[#8A7D71]">Loading...</div>
          : entries.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag size={40} className="text-[#C9B99A] mx-auto mb-2" />
              <p className="text-[#8A7D71] text-sm">No online sales recorded today</p>
            </div>
          ) : (
            <div className="divide-y divide-amber-900/5">
              {entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#8B5A2B]/5 transition-colors"
                  data-testid={`online-sale-${e.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ background: PLT_BG[e.platform], color: PLT_COLORS[e.platform] }}>
                      {e.platform?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-[#2C241B] capitalize">{e.platform}</p>
                      <p className="text-xs text-[#8A7D71]">{fmt(e.timestamp)} · Gross ₹{e.gross_sales}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-[#3E5C46]">₹{e.net_sales.toLocaleString("en-IN")}</p>
                      <p className="text-xs text-[#8A7D71]">Net</p>
                    </div>
                    <button onClick={() => handleDelete(e.id)}
                      className="text-[#8A7D71] hover:text-[#B84B4B] transition-colors" data-testid={`delete-sale-${e.id}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}
