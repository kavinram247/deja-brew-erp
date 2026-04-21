import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Users, Receipt, ShoppingBag, TrendingUp, AlertTriangle, Wallet, Coffee, Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import DateRangeToolbar, { computeRange } from "../../components/DateRangeToolbar";
import { downloadCsv } from "../../utils/csv";

function StatCard({ icon: Icon, label, value, sub, color = "#8B5A2B", testid }) {
  return (
    <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]"
      data-testid={testid}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, color }}>
          <Icon size={17} />
        </div>
        <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>{value}</p>
      {sub && <p className="text-xs text-[#8A7D71] mt-1">{sub}</p>}
    </div>
  );
}

export default function Overview() {
  const todayStr = new Date().toISOString().split("T")[0];
  const [range, setRange] = useState({ preset: "today", from: todayStr, to: todayStr });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/dashboard/analytics?from_date=${range.from}&to_date=${range.to}`);
        setRows(data);
      } catch { toast.error("Failed to load analytics"); }
      finally { setLoading(false); }
    })();
  }, [range.from, range.to]);

  const totals = rows.reduce((acc, r) => ({
    offline: acc.offline + r.offline_revenue,
    online: acc.online + r.online_revenue,
    total: acc.total + r.total_revenue,
    bills: acc.bills + r.bills,
    walkins: acc.walkins + r.walkins,
    guests: acc.guests + r.guests,
    cash: acc.cash + r.cash,
    upi: acc.upi + r.upi,
  }), { offline: 0, online: 0, total: 0, bills: 0, walkins: 0, guests: 0, cash: 0, upi: 0 });

  const platformAgg = {};
  rows.forEach((r) => {
    Object.entries(r.platforms || {}).forEach(([p, v]) => { platformAgg[p] = (platformAgg[p] || 0) + v; });
  });

  const rangeLabel = range.preset === "today" ? "Today"
    : range.preset === "week" ? "Last 7 Days"
    : range.preset === "month" ? "This Month" : `${range.from} → ${range.to}`;

  const exportCsv = () => {
    if (rows.length === 0) { toast.error("No data to export"); return; }
    downloadCsv(`dejabrew-overview-${range.from}_to_${range.to}.csv`, rows, [
      { key: "date", label: "Date" },
      { key: "offline_revenue", label: "Offline Revenue" },
      { key: "online_revenue", label: "Online Revenue" },
      { key: "total_revenue", label: "Total Revenue" },
      { key: "bills", label: "Bills" },
      { key: "walkins", label: "Walk-ins" },
      { key: "guests", label: "Guests" },
      { key: "cash", label: "Cash" },
      { key: "upi", label: "UPI" },
      { key: "platforms", label: "Platforms", format: (v) => v ? Object.entries(v).map(([k, val]) => `${k}:${val}`).join("|") : "" },
    ]);
    toast.success(`Exported ${rows.length} day(s)`);
  };

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Overview</h1>
          <p className="text-[#8A7D71] text-sm mt-1">{rangeLabel} · business insights</p>
        </div>
        <DateRangeToolbar {...range} onChange={setRange} />
        <button onClick={exportCsv}
          className="flex items-center gap-2 bg-[#3E5C46] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#2F4735]"
          data-testid="export-overview-csv">
          <Download size={14} /> CSV
        </button>
      </div>

      {loading ? <div className="text-center text-[#8A7D71] py-20"><Coffee className="mx-auto animate-pulse text-[#8B5A2B] mb-2" /> Loading...</div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard icon={TrendingUp} label="Total Revenue" value={`₹${totals.total.toLocaleString("en-IN")}`}
              sub={`₹${totals.offline.toFixed(0)} offline · ₹${totals.online.toFixed(0)} online`} color="#8B5A2B" testid="stat-total-revenue" />
            <StatCard icon={Receipt} label="Bills" value={totals.bills}
              sub={`₹${totals.cash.toFixed(0)} cash · ₹${totals.upi.toFixed(0)} UPI`} color="#3E5C46" testid="stat-bills" />
            <StatCard icon={Users} label="Walk-ins" value={totals.walkins}
              sub={`${totals.guests} guests`} color="#D48B3D" testid="stat-walkins" />
            <StatCard icon={ShoppingBag} label="Online Revenue" value={`₹${totals.online.toLocaleString("en-IN")}`}
              sub={`${Object.keys(platformAgg).length} platforms`} color="#C06C4C" testid="stat-online" />
          </div>

          {/* Revenue trend */}
          <div className="bg-white rounded-2xl border border-amber-900/10 p-6 shadow-[0_4px_24px_rgba(44,36,27,0.04)] mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Revenue Trend</h2>
              <span className="text-xs text-[#8A7D71]">{rows.length} day(s)</span>
            </div>
            {rows.length === 0 ? <p className="text-center text-[#8A7D71] py-10 text-sm">No data for this range</p> : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD1" />
                  <XAxis dataKey="date" tick={{ fill: "#8A7D71", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#8A7D71", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#FFF", border: "1px solid #E8DFD1", borderRadius: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="offline_revenue" stroke="#8B5A2B" strokeWidth={2} name="Offline" />
                  <Line type="monotone" dataKey="online_revenue" stroke="#D48B3D" strokeWidth={2} name="Online" />
                  <Line type="monotone" dataKey="total_revenue" stroke="#3E5C46" strokeWidth={2.5} name="Total" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Platform & Payment grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
              <h2 className="font-semibold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Online Platforms</h2>
              {Object.keys(platformAgg).length === 0 ? (
                <p className="text-[#8A7D71] text-sm text-center py-6">No online sales in this range</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(platformAgg).sort((a, b) => b[1] - a[1]).map(([p, v]) => {
                    const pct = totals.online > 0 ? (v / totals.online) * 100 : 0;
                    return (
                      <div key={p} data-testid={`platform-stat-${p}`}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-[#2C241B] capitalize font-medium">{p}</span>
                          <span className="text-[#8B5A2B] font-bold">₹{v.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="h-2 bg-[#F6F3EC] rounded-full overflow-hidden">
                          <div className="h-full bg-[#8B5A2B] rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
              <h2 className="font-semibold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Payment Mix (Offline)</h2>
              {totals.offline === 0 ? (
                <p className="text-[#8A7D71] text-sm text-center py-6">No offline bills</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[{ name: "Cash", value: totals.cash }, { name: "UPI", value: totals.upi }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD1" />
                    <XAxis dataKey="name" tick={{ fill: "#8A7D71", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#8A7D71", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#FFF", border: "1px solid #E8DFD1", borderRadius: 12 }} />
                    <Bar dataKey="value" fill="#8B5A2B" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
