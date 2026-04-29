import React, { useState, useEffect, useMemo } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from "recharts";
import DateRangeToolbar from "../../components/DateRangeToolbar";

const BUCKET_COLORS = {
  "Solo (1)":    "#8B5A2B",
  "Small (2–3)": "#3E5C46",
  "Medium (4–6)":"#D48B3D",
  "Large (7+)":  "#C06C4C",
};

export default function DWalkins() {
  const today = new Date().toISOString().split("T")[0];
  const [range, setRange] = useState({ preset: "week", from: "", to: today });
  const [rows, setRows] = useState([]);
  const [hourly, setHourly] = useState([]);
  const [dow, setDow] = useState([]);
  const [dowMetric, setDowMetric] = useState("revenue");
  const [partySizeData, setPartySizeData] = useState(null);
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
        const [{ data: analytics }, { data: hourlyData }, { data: dowData }, { data: psData }] = await Promise.all([
          api.get(`/dashboard/analytics?from_date=${range.from}&to_date=${range.to}`),
          api.get(`/dashboard/hourly-breakdown?from_date=${range.from}&to_date=${range.to}`),
          api.get(`/dashboard/dow-breakdown?from_date=${range.from}&to_date=${range.to}`),
          api.get(`/dashboard/party-size-revenue?from_date=${range.from}&to_date=${range.to}`),
        ]);
        setRows(analytics);
        setHourly(hourlyData);
        setDow(dowData);
        setPartySizeData(psData);
      } catch { toast.error("Failed to load"); }
      finally { setLoading(false); }
    })();
  }, [range.from, range.to]); // eslint-disable-line

  const totalWalkins = rows.reduce((s, r) => s + r.walkins, 0);
  const totalGuests = rows.reduce((s, r) => s + r.guests, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.offline_revenue, 0);
  const avgPartySize = totalWalkins > 0 ? (totalGuests / totalWalkins).toFixed(1) : "—";
  const revPerPerson = totalGuests > 0 ? `₹${(totalRevenue / totalGuests).toFixed(0)}` : "—";

  // Top 3 peak hours by bill count
  const top3Peaks = useMemo(() => (
    [...hourly].filter(h => h.bills > 0).sort((a, b) => b.bills - a.bills).slice(0, 3)
  ), [hourly]);

  // Dual-axis: party size vs rev/person over time
  const partyRevCorrelation = rows
    .filter(r => r.walkins > 0 && r.guests > 0)
    .map(r => ({
      date: r.date,
      avgParty: +(r.guests / r.walkins).toFixed(1),
      revPerPerson: +(r.offline_revenue / r.guests).toFixed(0),
    }));

  // Data-driven insights from party size matching
  const partyInsights = useMemo(() => {
    if (!partySizeData?.buckets) return [];
    const withRev = partySizeData.buckets.filter(b => b.avg_per_person > 0);
    if (withRev.length < 2) return [];
    const insights = [];

    // Spend decreases with group size → combo opportunity
    const bySize = [...withRev].sort((a, b) => a.min_guests - b.min_guests);
    const top = bySize[0];
    const bottom = bySize[bySize.length - 1];
    if (top && bottom && top.label !== bottom.label) {
      const drop = Math.round(((top.avg_per_person - bottom.avg_per_person) / top.avg_per_person) * 100);
      if (drop > 20) {
        insights.push(`${bottom.label} groups spend ₹${bottom.avg_per_person.toFixed(0)}/person vs ₹${top.avg_per_person.toFixed(0)} for ${top.label} — a group combo platter could bridge this gap`);
      }
    }

    // Solo premium
    const solo = withRev.find(b => b.min_guests === 1);
    const small = withRev.find(b => b.min_guests === 2);
    if (solo && small) {
      const premium = Math.round(((solo.avg_per_person - small.avg_per_person) / small.avg_per_person) * 100);
      if (premium > 20) insights.push(`Solo visitors spend ${premium}% more per person — highlight premium individual portions`);
    }

    // Dominant group size
    if (partySizeData.total_walkins > 0) {
      const dominant = partySizeData.buckets.reduce((m, b) => b.walkins > (m?.walkins || 0) ? b : m, null);
      if (dominant) {
        const pct = Math.round((dominant.walkins / partySizeData.total_walkins) * 100);
        if (pct >= 30) insights.push(`${dominant.label} groups are ${pct}% of walk-ins — optimise table layout and menu for them`);
      }
    }

    return insights.slice(0, 3);
  }, [partySizeData]);

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Walk-ins & Timing</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Guest flow, peak hours, and group revenue</p>
        </div>
        <DateRangeToolbar {...range} onChange={setRange} />
      </div>

      {loading ? <div className="text-center text-[#8A7D71] py-20">Loading...</div> : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Walk-ins", value: totalWalkins, color: "#8B5A2B", testid: "dw-total" },
              { label: "Total Guests",   value: totalGuests,  color: "#3E5C46", testid: "dw-guests" },
              { label: "Avg Party Size", value: avgPartySize, color: "#D48B3D", testid: "dw-party" },
              { label: "Rev / Person",   value: revPerPerson, color: "#C06C4C", testid: "dw-revpp" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid={s.testid}>
                <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest font-medium">{s.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: s.color, fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Multi-peak strip */}
          {top3Peaks.length > 0 && (
            <div className="bg-[#8B5A2B]/10 border border-[#8B5A2B]/20 rounded-2xl px-5 py-3 mb-6 flex flex-wrap items-center gap-x-5 gap-y-1">
              <div className="flex items-center gap-2 shrink-0">
                <Users size={18} className="text-[#8B5A2B]" />
                <span className="text-xs font-bold text-[#5C4F43] uppercase tracking-wider">Peak hours</span>
              </div>
              {top3Peaks.map((h, i) => (
                <span key={h.hour} className="text-sm text-[#5C4F43]">
                  <span className="font-bold text-[#2C241B]">{h.hour}:00–{h.hour + 1}:00</span>
                  &nbsp;· ₹{h.revenue.toLocaleString("en-IN")} · {h.bills} bill{h.bills !== 1 ? "s" : ""}
                  {i < top3Peaks.length - 1 && <span className="ml-5 text-[#C9B99A]">|</span>}
                </span>
              ))}
            </div>
          )}

          {/* Hourly Activity — top 3 peaks highlighted */}
          <div className="bg-white rounded-2xl border border-amber-900/10 p-6 shadow-[0_4px_24px_rgba(44,36,27,0.04)] mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Hourly Activity</h2>
              <div className="flex items-center gap-3 text-xs text-[#8A7D71]">
                {[["#8B5A2B", "Peak 1"], ["#D48B3D", "Peak 2"], ["#C9B99A", "Peak 3"]].map(([c, l]) => (
                  <span key={l} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c }} />{l}</span>
                ))}
              </div>
            </div>
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
                    formatter={(v) => [v, "Bills"]}
                  />
                  <Bar dataKey="bills" radius={[4, 4, 0, 0]}>
                    {hourly.map((h, i) => (
                      <Cell key={i} fill={
                        top3Peaks[0]?.hour === h.hour ? "#8B5A2B" :
                        top3Peaks[1]?.hour === h.hour ? "#D48B3D" :
                        top3Peaks[2]?.hour === h.hour ? "#C9B99A" :
                        "#E8DFD1"
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Party Size vs Rev/Person dual-axis trend */}
          <div className="bg-white rounded-2xl border border-amber-900/10 p-6 shadow-[0_4px_24px_rgba(44,36,27,0.04)] mb-6">
            <h2 className="font-semibold text-[#2C241B] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>Party Size vs Revenue/Person</h2>
            <p className="text-xs text-[#8A7D71] mb-4">See how group size correlates with per-person spend day by day</p>
            {partyRevCorrelation.length < 2 ? (
              <p className="text-[#8A7D71] py-8 text-center text-sm">Not enough daily data — try a longer range</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={partyRevCorrelation}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD1" />
                  <XAxis dataKey="date" tick={{ fill: "#8A7D71", fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fill: "#D48B3D", fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#3E5C46", fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip contentStyle={{ background: "#FFF", border: "1px solid #E8DFD1", borderRadius: 12 }}
                    formatter={(v, name) => [name === "Avg Party" ? v : `₹${v}`, name]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="left" type="monotone" dataKey="avgParty" stroke="#D48B3D" strokeWidth={2} name="Avg Party" dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="revPerPerson" stroke="#3E5C46" strokeWidth={2} name="Rev/Person ₹" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Party Size Revenue Analysis */}
          {partySizeData && partySizeData.total_walkins > 0 && (
            <div className="bg-white rounded-2xl border border-amber-900/10 p-6 shadow-[0_4px_24px_rgba(44,36,27,0.04)] mb-6">
              <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
                <div>
                  <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Party Size Revenue Breakdown</h2>
                  <p className="text-xs text-[#8A7D71] mt-0.5">
                    {partySizeData.match_rate >= 0.5
                      ? `${partySizeData.matched_count} of ${partySizeData.total_bills} bills matched to walk-ins (${Math.round(partySizeData.match_rate * 100)}%)`
                      : `Low match rate (${Math.round(partySizeData.match_rate * 100)}%) — log more walk-ins for better accuracy`}
                  </p>
                </div>
              </div>

              {/* Bucket summary tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
                {partySizeData.buckets.map((b) => (
                  <div key={b.label} className="rounded-xl p-3 border" style={{ borderColor: `${BUCKET_COLORS[b.label]}30`, background: `${BUCKET_COLORS[b.label]}08` }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: BUCKET_COLORS[b.label] }}>{b.label}</p>
                    <p className="text-lg font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>{b.walkins} groups</p>
                    <p className="text-xs text-[#8A7D71]">{b.guests} guests</p>
                    {b.avg_per_person > 0 && (
                      <p className="text-sm font-bold mt-1" style={{ color: BUCKET_COLORS[b.label] }}>
                        ₹{b.avg_per_person.toFixed(0)}<span className="text-xs font-normal text-[#8A7D71]">/person</span>
                      </p>
                    )}
                    {b.avg_per_person === 0 && <p className="text-xs text-[#C9B99A] mt-1">No revenue data</p>}
                  </div>
                ))}
              </div>

              {/* Horizontal bar: spend/person by bucket */}
              {partySizeData.buckets.some(b => b.avg_per_person > 0) && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#5C4F43] mb-3">Avg Spend / Person by Group Size</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart
                      data={partySizeData.buckets.filter(b => b.avg_per_person > 0)}
                      layout="vertical"
                      margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD1" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "#8A7D71", fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                      <YAxis type="category" dataKey="label" width={100} tick={{ fill: "#2C241B", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: "#FFF", border: "1px solid #E8DFD1", borderRadius: 12 }}
                        formatter={(v) => [`₹${v.toFixed(0)}`, "Avg/person"]}
                      />
                      <Bar dataKey="avg_per_person" radius={[0, 6, 6, 0]}>
                        {partySizeData.buckets.filter(b => b.avg_per_person > 0).map((b, i) => (
                          <Cell key={i} fill={BUCKET_COLORS[b.label] || "#8B5A2B"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Insight pills */}
              {partyInsights.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-wrap gap-2 items-start">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider shrink-0 mt-0.5">Insights</span>
                  <div className="flex flex-col gap-1.5">
                    {partyInsights.map((ins, i) => (
                      <span key={i} className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-medium w-fit">{ins}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Day-of-Week Breakdown */}
          {dow.length > 0 && (() => {
            const peakDow = dow.reduce((m, d) => d[dowMetric] > (m?.[dowMetric] || 0) ? d : m, null);
            return (
              <div className="bg-white rounded-2xl border border-amber-900/10 p-6 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Day-of-Week Breakdown</h2>
                  <div className="flex rounded-xl overflow-hidden border border-amber-900/20">
                    {[["revenue", "Revenue"], ["bills", "Bills"], ["walkins", "Walk-ins"]].map(([key, label]) => (
                      <button key={key} onClick={() => setDowMetric(key)}
                        className={`px-3 py-1.5 text-xs font-semibold transition-colors ${dowMetric === key ? "bg-[#8B5A2B] text-white" : "bg-white text-[#5C4F43] hover:bg-[#F6F3EC]"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {peakDow && peakDow[dowMetric] > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4 text-sm text-amber-800 font-medium">
                    Busiest: <span className="font-bold">{peakDow.label}</span>
                    {dowMetric === "revenue" && ` · ₹${peakDow.revenue.toLocaleString("en-IN")}`}
                    {dowMetric === "bills" && ` · ${peakDow.bills} bills`}
                    {dowMetric === "walkins" && ` · ${peakDow.walkins} walk-ins`}
                  </div>
                )}
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dow}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD1" />
                    <XAxis dataKey="label" tick={{ fill: "#8A7D71", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#8A7D71", fontSize: 11 }}
                      tickFormatter={(v) => dowMetric === "revenue" ? `₹${(v / 1000).toFixed(0)}k` : `${v}`} />
                    <Tooltip
                      contentStyle={{ background: "#FFF", border: "1px solid #E8DFD1", borderRadius: 12 }}
                      formatter={(v) => [dowMetric === "revenue" ? `₹${v.toLocaleString("en-IN")}` : v, dowMetric === "revenue" ? "Revenue" : dowMetric === "bills" ? "Bills" : "Walk-ins"]}
                    />
                    <Bar dataKey={dowMetric} radius={[6, 6, 0, 0]}>
                      {dow.map((d, i) => (
                        <Cell key={i} fill={d.label === peakDow?.label ? "#8B5A2B" : "#C9B99A"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
