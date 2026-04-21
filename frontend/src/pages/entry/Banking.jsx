import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Plus, Trash2, Landmark, X, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import ThemeDatePicker from "../../components/ThemeDatePicker";

function fmtTime(iso) {
  return new Date(iso).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export default function EntryBanking() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: "", depositor_name: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = async (d = date) => {
    setLoading(true);
    try { const { data } = await api.get(`/banking?date_str=${d}`); setEntries(data); }
    catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(date); }, [date]); // eslint-disable-line

  const changeDate = (delta) => {
    const dt = new Date(date + "T00:00:00"); dt.setDate(dt.getDate() + delta);
    setDate(dt.toISOString().split("T")[0]);
  };

  const isToday = date === today;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0 || !form.depositor_name.trim()) {
      toast.error("Fill amount and depositor"); return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/banking", {
        amount: parseFloat(form.amount),
        depositor_name: form.depositor_name,
        notes: form.notes || null,
      });
      if (isToday) setEntries((p) => [data, ...p]);
      setForm({ amount: "", depositor_name: "", notes: "" });
      setShowForm(false);
      toast.success("Cash handover recorded");
    } catch { toast.error("Failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this handover entry?")) return;
    try { await api.delete(`/banking/${id}`); setEntries((p) => p.filter((e) => e.id !== id)); toast.success("Deleted"); }
    catch { toast.error("Failed"); }
  };

  const total = entries.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Banking</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Cash handovers · {isToday ? "Today" : date}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"><ChevronLeft size={16} /></button>
          <ThemeDatePicker value={date} onChange={setDate} max={today} testid="entry-banking-date" />
          <button onClick={() => changeDate(1)} disabled={date >= today} className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10 disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => load(date)} className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#8B5A2B] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822] ml-1"
            data-testid="entry-banking-add-btn">
            <Plus size={16} /> New Handover
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="eb-total">
          <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">Total Deposited</p>
          <p className="text-2xl font-bold text-[#8B5A2B] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>₹{total.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="eb-count">
          <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">Entries</p>
          <p className="text-2xl font-bold text-[#3E5C46] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>{entries.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="eb-avg">
          <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">Average</p>
          <p className="text-2xl font-bold text-[#D48B3D] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>
            ₹{entries.length > 0 ? (total / entries.length).toLocaleString("en-IN", { maximumFractionDigits: 0 }) : 0}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        <div className="px-5 py-4 border-b border-amber-900/10">
          <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
            {isToday ? "Today's" : date} Handovers
          </h2>
        </div>
        {loading ? <div className="text-center text-[#8A7D71] py-10">Loading...</div>
          : entries.length === 0 ? (
            <div className="text-center py-12">
              <Landmark size={40} className="text-[#C9B99A] mx-auto mb-2" />
              <p className="text-[#8A7D71] text-sm">No handovers on this date</p>
            </div>
          ) : (
            <div className="divide-y divide-amber-900/5">
              {entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#8B5A2B]/5"
                  data-testid={`eb-entry-${e.id}`}>
                  <div>
                    <p className="text-sm font-medium text-[#2C241B]">{e.depositor_name}</p>
                    <p className="text-xs text-[#8A7D71]">{fmtTime(e.time)}{e.created_by_name ? ` · by ${e.created_by_name}` : ""}</p>
                    {e.notes && <p className="text-xs italic text-[#8A7D71] mt-0.5">"{e.notes}"</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#3E5C46]">₹{e.amount.toLocaleString("en-IN")}</span>
                    <button onClick={() => handleDelete(e.id)} className="text-[#8A7D71] hover:text-[#B84B4B]" data-testid={`del-eb-${e.id}`}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>New Cash Handover</h2>
              <button onClick={() => setShowForm(false)} className="text-[#8A7D71]"><X size={18} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Amount (₹) *</label>
                <input type="number" step="0.01" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} required
                  placeholder="0.00"
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="eb-amount" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Depositor Name *</label>
                <input value={form.depositor_name}
                  onChange={(e) => setForm({ ...form, depositor_name: e.target.value })} required
                  placeholder="e.g. Ravi / Manager"
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="eb-depositor" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Notes</label>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Deposited at HDFC, reference no..."
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold disabled:opacity-50"
                  data-testid="eb-save-btn">
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
