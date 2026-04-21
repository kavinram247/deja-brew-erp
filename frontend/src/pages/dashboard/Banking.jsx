import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Landmark } from "lucide-react";

function fmtTime(iso) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export default function DashBanking() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const { data } = await api.get("/banking/all"); setEntries(data); }
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

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Banking Overview</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Read-only · cash handovers across all days</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="banking-total">
          <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">Total Deposited</p>
          <p className="text-2xl font-bold text-[#8B5A2B] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>₹{total.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="banking-count">
          <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">Entries</p>
          <p className="text-2xl font-bold text-[#3E5C46] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>{entries.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="banking-days">
          <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">Active Days</p>
          <p className="text-2xl font-bold text-[#D48B3D] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>{dates.length}</p>
        </div>
      </div>

      {loading ? <div className="text-center text-[#8A7D71] py-10">Loading...</div>
        : entries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-amber-900/10 p-12 text-center">
            <Landmark size={40} className="text-[#C9B99A] mx-auto mb-2" />
            <p className="text-[#8A7D71] text-sm">No handovers logged yet — employees record these from the Banking module.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dates.map((d) => {
              const dayEntries = grouped[d];
              const dayTotal = dayEntries.reduce((s, e) => s + e.amount, 0);
              return (
                <div key={d} className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid={`banking-day-${d}`}>
                  <div className="flex items-center justify-between px-5 py-3 border-b border-amber-900/10 bg-[#F6F3EC] rounded-t-2xl">
                    <span className="font-semibold text-[#2C241B]">{d}</span>
                    <span className="text-sm font-bold text-[#8B5A2B]">₹{dayTotal.toLocaleString("en-IN")} · {dayEntries.length} entries</span>
                  </div>
                  <div className="divide-y divide-amber-900/5">
                    {dayEntries.map((e) => (
                      <div key={e.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#8B5A2B]/5"
                        data-testid={`banking-entry-${e.id}`}>
                        <div>
                          <p className="text-sm font-medium text-[#2C241B]">{e.depositor_name}</p>
                          <p className="text-xs text-[#8A7D71]">{fmtTime(e.time)}{e.created_by_name ? ` · by ${e.created_by_name}` : ""}</p>
                          {e.notes && <p className="text-xs italic text-[#8A7D71] mt-0.5">"{e.notes}"</p>}
                        </div>
                        <span className="font-bold text-[#3E5C46]">₹{e.amount.toLocaleString("en-IN")}</span>
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
