import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { toast } from "sonner";
import { Plus, LogIn, LogOut, Clock, Phone, Trash2, RefreshCw } from "lucide-react";

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  });
}
function fmtDuration(tin, tout) {
  if (!tin || !tout) return null;
  const ms = new Date(tout) - new Date(tin);
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function WalkIns() {
  const [walkins, setWalkins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/walkins?date_str=${date}`);
      setWalkins(data);
    } catch { toast.error("Failed to load walk-ins"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [date]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/walkins", {
        customer_name: name || "Guest",
        customer_phone: phone || null,
        notes: notes || null,
      });
      setWalkins((prev) => [...prev, data]);
      setName(""); setPhone(""); setNotes(""); setShowForm(false);
      toast.success("Walk-in logged");
    } catch { toast.error("Failed to log walk-in"); }
    finally { setSaving(false); }
  };

  const handleCheckout = async (id) => {
    try {
      const { data } = await api.put(`/walkins/${id}/checkout`);
      setWalkins((prev) => prev.map((w) => (w.id === id ? data : w)));
      toast.success("Checked out");
    } catch { toast.error("Failed to check out"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this walk-in?")) return;
    try {
      await api.delete(`/walkins/${id}`);
      setWalkins((prev) => prev.filter((w) => w.id !== id));
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const active = walkins.filter((w) => !w.time_out);
  const completed = walkins.filter((w) => w.time_out);

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Walk-ins</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Track customer arrivals and departures</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-amber-900/20 px-3 py-2 text-sm text-[#2C241B] focus:outline-none focus:border-[#8B5A2B]"
            data-testid="walkin-date-picker"
          />
          <button onClick={load} className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10 transition-colors">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#8B5A2B] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822] transition-colors"
            data-testid="log-walkin-btn"
          >
            <Plus size={16} /> Log Walk-in
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total", value: walkins.length, color: "#8B5A2B" },
          { label: "Inside Now", value: active.length, color: "#D48B3D" },
          { label: "Completed", value: completed.length, color: "#3E5C46" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-amber-900/10 p-4 text-center shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
            <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
            <p className="text-xs text-[#8A7D71] mt-1 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Log Walk-in modal */}
      {showForm && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl slide-up">
            <h2 className="text-lg font-bold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
              Log Walk-in
            </h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Customer Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Guest"
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm text-[#2C241B] focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="walkin-name-input"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Phone (optional)</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 ..."
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm text-[#2C241B] focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="walkin-phone-input"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Notes (optional)</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Table 3..."
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm text-[#2C241B] focus:outline-none focus:border-[#8B5A2B]"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43] hover:bg-[#F6F3EC] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold hover:bg-[#704822] transition-colors disabled:opacity-50"
                  data-testid="walkin-submit-btn">
                  {saving ? "Saving..." : "Log In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active walk-ins */}
      {active.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[#8A7D71] uppercase tracking-wider mb-3">Currently Inside ({active.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {active.map((w) => (
              <div key={w.id} className="bg-white rounded-2xl border border-amber-900/10 p-4 shadow-[0_4px_24px_rgba(44,36,27,0.04)] flex items-center justify-between"
                data-testid={`active-walkin-${w.id}`}>
                <div>
                  <p className="font-semibold text-[#2C241B]">{w.customer_name}</p>
                  {w.customer_phone && (
                    <p className="text-xs text-[#8A7D71] flex items-center gap-1 mt-0.5">
                      <Phone size={10} /> {w.customer_phone}
                    </p>
                  )}
                  <p className="text-xs text-[#8A7D71] flex items-center gap-1 mt-1">
                    <LogIn size={10} /> Arrived {fmt(w.time_in)}
                  </p>
                </div>
                <button
                  onClick={() => handleCheckout(w.id)}
                  className="flex items-center gap-1 bg-[#3E5C46]/10 text-[#3E5C46] hover:bg-[#3E5C46]/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  data-testid={`checkout-btn-${w.id}`}
                >
                  <LogOut size={12} /> Check Out
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All walk-ins table */}
      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        <div className="px-5 py-4 border-b border-amber-900/10">
          <h2 className="text-base font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
            All Walk-ins {date !== new Date().toISOString().split("T")[0] ? `(${date})` : "(Today)"}
          </h2>
        </div>
        {loading ? (
          <div className="text-center text-[#8A7D71] py-10 text-sm">Loading...</div>
        ) : walkins.length === 0 ? (
          <div className="text-center text-[#8A7D71] py-10 text-sm">No walk-ins recorded yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-900/10">
                  <th className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">#</th>
                  <th className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">Customer</th>
                  <th className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">Time In</th>
                  <th className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">Time Out</th>
                  <th className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">Duration</th>
                  <th className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {walkins.map((w, i) => (
                  <tr key={w.id} className="border-b border-amber-900/5 hover:bg-[#8B5A2B]/5 transition-colors" data-testid={`walkin-row-${w.id}`}>
                    <td className="px-5 py-3 text-[#8A7D71]">{i + 1}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-[#2C241B]">{w.customer_name}</p>
                      {w.customer_phone && <p className="text-xs text-[#8A7D71]">{w.customer_phone}</p>}
                    </td>
                    <td className="px-5 py-3 text-[#5C4F43] flex items-center gap-1">
                      <Clock size={12} className="text-[#8A7D71]" /> {fmt(w.time_in)}
                    </td>
                    <td className="px-5 py-3 text-[#5C4F43]">{fmt(w.time_out)}</td>
                    <td className="px-5 py-3 text-[#8A7D71] text-xs">{fmtDuration(w.time_in, w.time_out) || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        w.time_out ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {w.time_out ? "Completed" : "Inside"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {!w.time_out && (
                          <button onClick={() => handleCheckout(w.id)}
                            className="text-[#3E5C46] hover:text-[#2a3f31] transition-colors" title="Check Out"
                            data-testid={`table-checkout-${w.id}`}>
                            <LogOut size={14} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(w.id)}
                          className="text-[#8A7D71] hover:text-[#B84B4B] transition-colors" title="Delete"
                          data-testid={`delete-walkin-${w.id}`}>
                          <Trash2 size={14} />
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
    </div>
  );
}
