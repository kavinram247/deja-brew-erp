import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import DateRangeToolbar from "../../components/DateRangeToolbar";

export default function DWalkins() {
  const today = new Date().toISOString().split("T")[0];
  const [range, setRange] = useState({ preset: "week", from: "", to: today });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!range.from) {
      const d = new Date(); d.setDate(d.getDate() - 6);
      setRange({ preset: "week", from: d.toISOString().split("T")[0], to: today });
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/dashboard/analytics?from_date=${range.from}&to_date=${range.to}`);
        setRows(data);
      } catch { toast.error("Failed to load"); }
      finally { setLoading(false); }
    })();
  }, [range.from, range.to]); // eslint-disable-line

  const totalWalkins = rows.reduce((s, r) => s + r.walkins, 0);
  const totalGuests = rows.reduce((s, r) => s + r.guests, 0);
  const avgGuests = rows.length > 0 ? (totalGuests / Math.max(1, rows.length)).toFixed(1) : 0;
  const peak = rows.reduce((m, r) => r.walkins > (m?.walkins || 0) ? r : m, null);

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Walk-ins Analytics</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Guest flow insights</p>
        </div>
        <DateRangeToolbar {...range} onChange={setRange} />
      </div>

      {loading ? <div className="text-center text-[#8A7D71] py-20">Loading...</div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Walk-ins", value: totalWalkins, color: "#8B5A2B", testid: "dw-total" },
              { label: "Total Guests", value: totalGuests, color: "#3E5C46", testid: "dw-guests" },
              { label: "Avg Guests/Day", value: avgGuests, color: "#D48B3D", testid: "dw-avg" },
              { label: "Peak Day", value: peak?.date || "—", sub: peak ? `${peak.walkins} walk-ins` : "", color: "#C06C4C", testid: "dw-peak" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid={s.testid}>
                <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest font-medium">{s.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: s.color, fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
                {s.sub && <p className="text-xs text-[#8A7D71] mt-1">{s.sub}</p>}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-amber-900/10 p-6 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
            <h2 className="font-semibold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Daily Walk-ins</h2>
            {rows.length === 0 ? <p className="text-[#8A7D71] py-10 text-center text-sm">No data</p> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD1" />
                  <XAxis dataKey="date" tick={{ fill: "#8A7D71", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#8A7D71", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#FFF", border: "1px solid #E8DFD1", borderRadius: 12 }} />
                  <Bar dataKey="walkins" fill="#8B5A2B" radius={[8, 8, 0, 0]} name="Walk-ins" />
                  <Bar dataKey="guests" fill="#D48B3D" radius={[8, 8, 0, 0]} name="Guests" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}
