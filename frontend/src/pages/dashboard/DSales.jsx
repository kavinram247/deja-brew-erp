import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from "recharts";
import DateRangeToolbar from "../../components/DateRangeToolbar";
import { downloadCsv } from "../../utils/csv";

export default function DSales() {
  const today = new Date().toISOString().split("T")[0];
  const [range, setRange] = useState({ preset: "month", from: "", to: today });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!range.from) {
      const d = new Date(); setRange({ preset: "month", from: today.slice(0, 8) + "01", to: today });
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/dashboard/analytics?from_date=${range.from}&to_date=${range.to}`);
        setRows(data);
      } catch { toast.error("Failed"); }
      finally { setLoading(false); }
    })();
  }, [range.from, range.to]); // eslint-disable-line

  const totals = rows.reduce((acc, r) => ({
    offline: acc.offline + r.offline_revenue,
    online: acc.online + r.online_revenue,
    total: acc.total + r.total_revenue,
    bills: acc.bills + r.bills,
    cash: acc.cash + r.cash,
    upi: acc.upi + r.upi,
  }), { offline: 0, online: 0, total: 0, bills: 0, cash: 0, upi: 0 });

  const platformAgg = {};
  rows.forEach((r) => {
    Object.entries(r.platforms || {}).forEach(([p, v]) => { platformAgg[p] = (platformAgg[p] || 0) + v; });
  });

  const avgBillValue = totals.bills > 0 ? (totals.offline / totals.bills).toFixed(0) : 0;

  const exportCsv = () => {
    if (rows.length === 0) { toast.error("No data to export"); return; }
    downloadCsv(`dejabrew-sales-${range.from}_to_${range.to}.csv`, rows, [
      { key: "date", label: "Date" },
      { key: "offline_revenue", label: "Offline Revenue" },
      { key: "online_revenue", label: "Online Revenue" },
      { key: "total_revenue", label: "Total Revenue" },
      { key: "bills", label: "Bills" },
      { key: "cash", label: "Cash" },
      { key: "upi", label: "UPI" },
      { key: "platforms", label: "Platform Breakdown", format: (v) => v ? Object.entries(v).map(([k, val]) => `${k}:${val}`).join("|") : "" },
    ]);
    toast.success(`Exported ${rows.length} day(s)`);
  };

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Sales Analytics</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Offline + Online performance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeToolbar {...range} onChange={setRange} />
          <button onClick={exportCsv}
            className="flex items-center gap-2 bg-[#3E5C46] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#2F4735]"
            data-testid="export-sales-csv">
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {loading ? <div className="text-center text-[#8A7D71] py-20">Loading...</div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Revenue", value: `₹${totals.total.toLocaleString("en-IN")}`, color: "#8B5A2B", testid: "ds-total" },
              { label: "Offline", value: `₹${totals.offline.toLocaleString("en-IN")}`, sub: `${totals.bills} bills`, color: "#3E5C46", testid: "ds-offline" },
              { label: "Online", value: `₹${totals.online.toLocaleString("en-IN")}`, sub: `${Object.keys(platformAgg).length} platforms`, color: "#D48B3D", testid: "ds-online" },
              { label: "Avg Bill", value: `₹${avgBillValue}`, color: "#C06C4C", testid: "ds-avg" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid={s.testid}>
                <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest font-medium">{s.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: s.color, fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
                {s.sub && <p className="text-xs text-[#8A7D71] mt-1">{s.sub}</p>}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-amber-900/10 p-6 shadow-[0_4px_24px_rgba(44,36,27,0.04)] mb-6">
            <h2 className="font-semibold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Offline vs Online</h2>
            {rows.length === 0 ? <p className="text-[#8A7D71] py-10 text-center text-sm">No data</p> : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={rows}>
                  <defs>
                    <linearGradient id="offG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5A2B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8B5A2B" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="onG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D48B3D" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D48B3D" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD1" />
                  <XAxis dataKey="date" tick={{ fill: "#8A7D71", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#8A7D71", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#FFF", border: "1px solid #E8DFD1", borderRadius: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="offline_revenue" stroke="#8B5A2B" strokeWidth={2} fill="url(#offG)" name="Offline" />
                  <Area type="monotone" dataKey="online_revenue" stroke="#D48B3D" strokeWidth={2} fill="url(#onG)" name="Online" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-amber-900/10 p-6 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
            <h2 className="font-semibold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Platform Breakdown</h2>
            {Object.keys(platformAgg).length === 0 ? (
              <p className="text-[#8A7D71] text-center py-6 text-sm">No online sales in range</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(platformAgg).sort((a, b) => b[1] - a[1]).map(([p, v]) => {
                  const pct = totals.online > 0 ? (v / totals.online) * 100 : 0;
                  return (
                    <div key={p} className="bg-[#F6F3EC] rounded-xl p-4" data-testid={`ds-platform-${p}`}>
                      <p className="text-[11px] text-[#8A7D71] uppercase tracking-widest capitalize">{p}</p>
                      <p className="text-xl font-bold text-[#2C241B] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>₹{v.toLocaleString("en-IN")}</p>
                      <p className="text-xs text-[#8B5A2B] font-semibold mt-0.5">{pct.toFixed(1)}% of online</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
