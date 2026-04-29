import React, { useState, useEffect, useMemo } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import DateRangeToolbar from "../../components/DateRangeToolbar";

export default function DWalkins() {
  const today = new Date().toISOString().split("T")[0];
  const [range, setRange] = useState({ preset: "week", from: "", to: today });
  const [rows, setRows] = useState([]);
  const [hourly, setHourly] = useState([]);
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
        const [{ data: analytics }, { data: hourlyData }] = await Promise.all([
          api.get(`/dashboard/analytics?from_date=${range.from}&to_date=${range.to}`),
          api.get(`/dashboard/hourly-breakdown?from_date=${range.from}&to_date=${range.to}`),
        ]);
        setRows(analytics);
        setHourly(hourlyData);
      } catch { toast.error("Failed to load"); }
      finally { setLoading(false); }
    })();
  }, [range.from, range.to]); // eslint-disable-line

  const totalWalkins = rows.reduce((s, r) => s + r.walkins, 0);
  const totalGuests = rows.reduce((s, r) => s + r.guests, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.offline_revenue, 0);
  const avgPartySize = totalWalkins > 0 ? (totalGuests / totalWalkins).toFixed(1) : "—";
  const revPerPerson = totalGuests > 0 ? `₹${(totalRevenue / totalGuests).toFixed(0)}` : "—";

  const peakHour = useMemo(() => {
    if (!hourly.length) return null;
    const peak = hourly.reduce((m, h) => h.bills > (m?.bills || 0) ? h : m, null);
    return peak?.bills > 0 ? peak : null;
  }, [hourly]);

  const dailyPartySize = rows.map((r) => ({
    date: r.date,
    avgParty: r.walkins > 0 ? +(r.guests / r.walkins).toFixed(2) : 0,
  }));

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Walk-ins & Timing</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Guest flow and peak hour insights</p>
        </div>
        <DateRangeToolbar {...range} onChange={setRange} />
      </div>

      {loading ? <div className="text-center text-[#8A7D71] py-20">Loading...</div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Walk-ins", value: totalWalkins, color: "#8B5A2B", testid: "dw-total" },
              { label: "Total Guests", value: totalGuests, color: "#3E5C46", testid: "dw-guests" },
              { label: "Avg Party Size", value: avgPartySize, color: "#D48B3D", testid: "dw-party" },
              { label: "Rev / Person", value: revPerPerson, color: "#C06C4C", testid: "dw-revpp" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid={s.testid}>
                <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest font-medium">{s.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: s.color, fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
              </div>
            ))}
          </div>

          {peakHour && (
            <div className="bg-[#8B5A2B]/10 border border-[#8B5A2B]/20 rounded-2xl px-5 py-3 mb-6 flex items-center gap-3">
              <Users size={18} className="text-[#8B5A2B] shrink-0" />
              <p className="text-sm text-[#5C4F43] font-medium">
                Peak: <span className="text-[#2C241B] font-bold">{peakHour.hour}:00–{peakHour.hour + 1}:00</span>
                &nbsp;· ₹{peakHour.revenue.toLocaleString("en-IN")}
                &nbsp;· {peakHour.bills} bill{peakHour.bills !== 1 ? "s" : ""}
              </p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-amber-900/10 p-6 shadow-[0_4px_24px_rgba(44,36,27,0.04)] mb-6">
            <h2 className="font-semibold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Hourly Activity</h2>
            {hourly.every((h) => h.bills === 0) ? (
              <p className="text-[#8A7D71] py-10 text-center text-sm">No bill data for this range</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD1" />
                  <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} tick={{ fill: "#8A7D71", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#8A7D71", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#FFF", border: "1px solid #E8DFD1", borderRadius: 12 }}
                    labelFormatter={(h) => `${h}:00–${h + 1}:00`}
                    formatter={(v, name) => [v, name === "bills" ? "Bills" : name]}
                  />
                  <Bar dataKey="bills" name="bills" radius={[4, 4, 0, 0]}>
                    {hourly.map((h, i) => (
                      <Cell key={i} fill={h.hour === peakHour?.hour ? "#8B5A2B" : "#C9B99A"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-amber-900/10 p-6 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
            <h2 className="font-semibold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Daily Avg Party Size</h2>
            {dailyPartySize.every((d) => d.avgParty === 0) ? (
              <p className="text-[#8A7D71] py-10 text-center text-sm">No walk-in data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyPartySize}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD1" />
                  <XAxis dataKey="date" tick={{ fill: "#8A7D71", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#8A7D71", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#FFF", border: "1px solid #E8DFD1", borderRadius: 12 }} />
                  <Line type="monotone" dataKey="avgParty" stroke="#D48B3D" strokeWidth={2} name="Avg Party" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}
