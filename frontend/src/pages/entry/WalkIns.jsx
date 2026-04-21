import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Plus, Trash2, Users2, RefreshCw } from "lucide-react";

const PAYMENT_MODES = ["cash", "upi", "split"];

function fmt(iso) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export default function WalkIns() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [guests, setGuests] = useState(1);
  const [mode, setMode] = useState("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get(`/walkins?date_str=${date}`); setEntries(data); }
    catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [date]);

  const totalGuests = entries.reduce((s, e) => s + (e.num_guests || 1), 0);

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const { data } = await api.post("/walkins", { num_guests: parseInt(guests), payment_mode: mode, notes: notes || null });
      setEntries((p) => [...p, data]);
      setGuests(1); setMode("cash"); setNotes(""); setShowForm(false);
      toast.success("Walk-in logged");
    } catch { toast.error("Failed to log"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/walkins/${id}`); setEntries((p) => p.filter((e) => e.id !== id)); toast.success("Deleted"); }
    catch { toast.error("Failed"); }
  };

  const byMode = { cash: 0, upi: 0, split: 0 };
  entries.forEach((e) => { if (byMode[e.payment_mode] !== undefined) byMode[e.payment_mode]++; });

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Walk-ins</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Record guest arrivals</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
            data-testid="walkin-date-picker" />
          <button onClick={load} className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#8B5A2B] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]"
            data-testid="log-walkin-btn">
            <Plus size={16} /> Log Walk-in
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Entries", value: entries.length, color: "#8B5A2B" },
          { label: "Total Guests", value: totalGuests, color: "#3E5C46" },
          { label: "Cash Entries", value: byMode.cash, color: "#D48B3D" },
          { label: "UPI / Split", value: byMode.upi + byMode.split, color: "#C06C4C" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-amber-900/10 p-4 shadow-[0_4px_24px_rgba(44,36,27,0.04)]"
            data-testid={`walkin-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
            <p className="text-xs text-[#8A7D71] mt-1 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl slide-up">
            <h2 className="text-lg font-bold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Log Walk-in</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Number of Guests *</label>
                <input type="number" min="1" value={guests} onChange={(e) => setGuests(e.target.value)}
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="walkin-guests-input" required />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-2 block">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_MODES.map((m) => (
                    <button key={m} type="button" onClick={() => setMode(m)}
                      className={`py-2 rounded-xl text-xs font-semibold transition-colors capitalize ${
                        mode === m ? "bg-[#8B5A2B] text-white" : "bg-[#F6F3EC] text-[#5C4F43] hover:bg-[#8B5A2B]/10"
                      }`}
                      data-testid={`walkin-mode-${m}`}>
                      {m === "split" ? "Cash+UPI" : m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Notes (optional)</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Table 3, reservation..."
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold disabled:opacity-50"
                  data-testid="walkin-submit-btn">
                  {saving ? "Saving..." : "Log In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        <div className="px-5 py-4 border-b border-amber-900/10">
          <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
            {date === new Date().toISOString().split("T")[0] ? "Today's" : date} Entries
          </h2>
        </div>
        {loading ? <div className="text-center text-[#8A7D71] py-10">Loading...</div> :
          entries.length === 0 ? (
            <div className="text-center py-12">
              <Users2 size={40} className="text-[#C9B99A] mx-auto mb-2" />
              <p className="text-[#8A7D71] text-sm">No walk-ins logged yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-amber-900/10">
                  {["#", "Time", "Guests", "Payment", "Notes", ""].map((h) => (
                    <th key={h} className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={e.id} className="border-b border-amber-900/5 hover:bg-[#8B5A2B]/5 transition-colors"
                      data-testid={`walkin-row-${e.id}`}>
                      <td className="px-5 py-3 text-[#8A7D71]">{i + 1}</td>
                      <td className="px-5 py-3 font-medium text-[#2C241B]">{fmt(e.time)}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 bg-[#8B5A2B]/10 text-[#8B5A2B] px-2 py-0.5 rounded-full text-xs font-bold">
                          <Users2 size={10} /> {e.num_guests}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          e.payment_mode === "cash" ? "bg-green-100 text-green-700"
                          : e.payment_mode === "upi" ? "bg-blue-100 text-blue-700"
                          : "bg-orange-100 text-orange-700"
                        }`}>
                          {e.payment_mode === "split" ? "Cash+UPI" : e.payment_mode?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[#8A7D71] text-xs">{e.notes || "—"}</td>
                      <td className="px-5 py-3">
                        <button onClick={() => handleDelete(e.id)}
                          className="text-[#8A7D71] hover:text-[#B84B4B] transition-colors" data-testid={`delete-walkin-${e.id}`}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}
