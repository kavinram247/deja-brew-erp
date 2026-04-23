import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Banknote } from "lucide-react";

function fmtTime(iso) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export default function DMiscPayments() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const { data } = await api.get("/misc-payments/all"); setEntries(data); }
      catch { toast.error("Failed"); }
      finally { setLoading(false); }
    })();
  }, []);

  const grouped = entries.reduce((acc, e) => {
    (acc[e.date] = acc[e.date] || []).push(e);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const total = entries.reduce((s, e) => s + (e.amount || 0), 0);

  // Category breakdown
  const catMap = {};
  entries.forEach((e) => { catMap[e.category] = (catMap[e.category] || 0) + (e.amount || 0); });

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Misc Payments Overview</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Read-only · last 200 received misc payments</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="dmisc-total">
          <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">Total Received</p>
          <p className="text-2xl font-bold text-[#3E5C46] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>₹{total.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="dmisc-count">
          <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">Entries</p>
          <p className="text-2xl font-bold text-[#8B5A2B] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>{entries.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="dmisc-days">
          <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">Active Days</p>
          <p className="text-2xl font-bold text-[#D48B3D] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>{dates.length}</p>
        </div>
      </div>

      {/* Category breakdown */}
      {Object.keys(catMap).length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-900/10 p-6 shadow-[0_4px_24px_rgba(44,36,27,0.04)] mb-6">
          <h2 className="font-semibold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>By Category</h2>
          <div className="space-y-3">
            {Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([c, v]) => {
              const pct = total > 0 ? (v / total) * 100 : 0;
              return (
                <div key={c} data-testid={`dmisc-cat-${c.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#2C241B] font-medium">{c}</span>
                    <span className="text-[#8B5A2B] font-bold">₹{v.toLocaleString("en-IN")} · {pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-[#F6F3EC] rounded-full overflow-hidden">
                    <div className="h-full bg-[#8B5A2B] rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? <div className="text-center text-[#8A7D71] py-10">Loading...</div>
        : entries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-amber-900/10 p-12 text-center">
            <Banknote size={40} className="text-[#C9B99A] mx-auto mb-2" />
            <p className="text-[#8A7D71] text-sm">No misc payments logged yet — employees record these from the Misc Payments module.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dates.map((d) => {
              const dayEntries = grouped[d];
              const dayTotal = dayEntries.reduce((s, e) => s + e.amount, 0);
              return (
                <div key={d} className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid={`dmisc-day-${d}`}>
                  <div className="flex items-center justify-between px-5 py-3 border-b border-amber-900/10 bg-[#F6F3EC] rounded-t-2xl">
                    <span className="font-semibold text-[#2C241B]">{d}</span>
                    <span className="text-sm font-bold text-[#3E5C46]">+₹{dayTotal.toLocaleString("en-IN")} · {dayEntries.length} entries</span>
                  </div>
                  <div className="divide-y divide-amber-900/5">
                    {dayEntries.map((e) => (
                      <div key={e.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#8B5A2B]/5"
                        data-testid={`dmisc-entry-${e.id}`}>
                        <div>
                          <p className="text-sm font-medium text-[#2C241B]">{e.source}</p>
                          <p className="text-xs text-[#8A7D71]">
                            {fmtTime(e.time)} · <span className="text-[#8B5A2B]">{e.category}</span> · {e.payment_mode?.toUpperCase()}
                            {e.created_by_name ? ` · by ${e.created_by_name}` : ""}
                          </p>
                          {e.notes && <p className="text-xs italic text-[#8A7D71] mt-0.5">"{e.notes}"</p>}
                        </div>
                        <span className="font-bold text-[#3E5C46]">+₹{e.amount.toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
