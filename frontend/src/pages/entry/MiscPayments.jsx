import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Plus, Trash2, Banknote, X, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import ThemeDatePicker from "../../components/ThemeDatePicker";

const CATEGORIES = ["Tips", "Scrap Sale", "Refund Received", "Deposit Refund", "Reimbursement", "Other"];
const MODES = ["cash", "upi", "other"];

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export default function MiscPayments() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    amount: "", source: "", category: "Tips", payment_mode: "cash", notes: "", date: today,
  });
  const [saving, setSaving] = useState(false);

  const load = async (d = date) => {
    setLoading(true);
    try { const { data } = await api.get(`/misc-payments?date_str=${d}`); setEntries(data); }
    catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(date); }, [date]); // eslint-disable-line

  const changeDate = (delta) => {
    const dt = new Date(date + "T00:00:00"); dt.setDate(dt.getDate() + delta);
    setDate(dt.toISOString().split("T")[0]);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0 || !form.source.trim()) {
      toast.error("Fill amount and source"); return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/misc-payments", {
        amount: parseFloat(form.amount),
        source: form.source,
        category: form.category,
        payment_mode: form.payment_mode,
        notes: form.notes || null,
        date: form.date || null,
      });
      if (data.date === date) setEntries((p) => [data, ...p]);
      setForm({ amount: "", source: "", category: "Tips", payment_mode: "cash", notes: "", date: today });
      setShowForm(false);
      toast.success(`Misc payment recorded${data.date !== date ? ` for ${data.date}` : ""}`);
    } catch { toast.error("Failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    try { await api.delete(`/misc-payments/${id}`); setEntries((p) => p.filter((e) => e.id !== id)); toast.success("Deleted"); }
    catch { toast.error("Failed"); }
  };

  const total = entries.reduce((s, e) => s + (e.amount || 0), 0);
  const byMode = entries.reduce((acc, e) => { acc[e.payment_mode] = (acc[e.payment_mode] || 0) + (e.amount || 0); return acc; }, {});

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Misc Payments</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Received · tips, scrap sale, refunds · {date === today ? "Today" : date}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"><ChevronLeft size={16} /></button>
          <ThemeDatePicker value={date} onChange={setDate} max={today} testid="misc-date-picker" />
          <button onClick={() => changeDate(1)} disabled={date >= today} className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10 disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => load(date)} className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#8B5A2B] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822] ml-1"
            data-testid="misc-add-btn">
            <Plus size={16} /> Record Payment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="misc-total">
          <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">Total Received</p>
          <p className="text-2xl font-bold text-[#3E5C46] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>₹{total.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="misc-count">
          <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">Entries</p>
          <p className="text-2xl font-bold text-[#8B5A2B] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>{entries.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="misc-cash">
          <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">Cash</p>
          <p className="text-2xl font-bold text-[#D48B3D] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>₹{(byMode.cash || 0).toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="misc-upi">
          <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">UPI</p>
          <p className="text-2xl font-bold text-[#C06C4C] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>₹{(byMode.upi || 0).toLocaleString("en-IN")}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        <div className="px-5 py-4 border-b border-amber-900/10">
          <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
            {date === today ? "Today's" : date} Payments
          </h2>
        </div>
        {loading ? <div className="text-center text-[#8A7D71] py-10">Loading...</div>
          : entries.length === 0 ? (
            <div className="text-center py-12">
              <Banknote size={40} className="text-[#C9B99A] mx-auto mb-2" />
              <p className="text-[#8A7D71] text-sm">No misc payments on this date</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-amber-900/10">
                  {["Time", "Source", "Category", "Mode", "Notes", "Amount", ""].map((h) => (
                    <th key={h} className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-amber-900/5 hover:bg-[#8B5A2B]/5" data-testid={`misc-row-${e.id}`}>
                      <td className="px-5 py-3 text-[#8A7D71]">{fmtTime(e.time)}</td>
                      <td className="px-5 py-3 text-[#2C241B] font-medium">{e.source}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-[#8B5A2B]/10 text-[#8B5A2B] px-2 py-0.5 rounded-full font-medium">{e.category}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          e.payment_mode === "cash" ? "bg-green-100 text-green-700"
                          : e.payment_mode === "upi" ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                        }`}>{e.payment_mode?.toUpperCase()}</span>
                      </td>
                      <td className="px-5 py-3 text-[#8A7D71] text-xs">{e.notes || "—"}</td>
                      <td className="px-5 py-3 text-right font-bold text-[#3E5C46]">+₹{e.amount.toLocaleString("en-IN")}</td>
                      <td className="px-5 py-3">
                        <button onClick={() => handleDelete(e.id)} className="text-[#8A7D71] hover:text-[#B84B4B]" data-testid={`del-misc-${e.id}`}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[#F6F3EC] font-bold">
                    <td colSpan="5" className="px-5 py-3 text-[#2C241B]">Total</td>
                    <td className="px-5 py-3 text-right text-[#3E5C46]">+₹{total.toLocaleString("en-IN")}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Record Misc Payment</h2>
              <button onClick={() => setShowForm(false)} className="text-[#8A7D71]"><X size={18} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Date *</label>
                <ThemeDatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} max={today} testid="misc-form-date" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Amount (₹) *</label>
                <input type="number" step="0.01" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} required
                  placeholder="0.00"
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="misc-amount" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Source *</label>
                <input value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })} required
                  placeholder="e.g. Table 5 tip, Scrap dealer"
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="misc-source" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="misc-category">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-2 block">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {MODES.map((m) => (
                    <button key={m} type="button" onClick={() => setForm({ ...form, payment_mode: m })}
                      className={`py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
                        form.payment_mode === m ? "bg-[#8B5A2B] text-white" : "bg-[#F6F3EC] text-[#5C4F43] hover:bg-[#8B5A2B]/10"
                      }`}
                      data-testid={`misc-mode-${m}`}>{m.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Notes</label>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional reference / details"
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold disabled:opacity-50"
                  data-testid="misc-save-btn">
                  {saving ? "Saving..." : "Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
