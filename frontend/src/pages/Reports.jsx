import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

function fmt(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const COLORS = ["#8B5A2B", "#3E5C46", "#D48B3D"];

export default function Reports() {
  const [range, setRange] = useState("7");
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const applyPreset = (days) => {
    const t = new Date().toISOString().split("T")[0];
    const f = new Date(); f.setDate(f.getDate() - (days - 1));
    setFrom(f.toISOString().split("T")[0]); setTo(t); setRange(String(days));
  };

  useEffect(() => {
    loadData();
  }, [from, to]);

  const loadData = async () => {
    setLoading(true);
    try {
      const rows = [];
      const start = new Date(from + "T00:00:00");
      const end = new Date(to + "T00:00:00");
      const promises = [];
      const dates = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ds = d.toISOString().split("T")[0];
        dates.push(ds);
        promises.push(api.get(`/dashboard/stats?date_str=${ds}`));
      }
      const results = await Promise.all(promises);
      results.forEach((r, i) => {
        rows.push({ date: dates[i], revenue: r.data.bills.revenue, walkins: r.data.walkins.total, bills: r.data.bills.total, cash: r.data.bills.cash, upi: r.data.bills.upi });
      });
      setData(rows);
    } catch {}
    finally { setLoading(false); }
  };

  const totalRev = data.reduce((s, d) => s + d.revenue, 0);
  const totalWalkins = data.reduce((s, d) => s + d.walkins, 0);
  const totalBills = data.reduce((s, d) => s + d.bills, 0);
  const totalCash = data.reduce((s, d) => s + d.cash, 0);
  const totalUpi = data.reduce((s, d) => s + d.upi, 0);
  const avgBill = totalBills ? (totalRev / totalBills).toFixed(0) : 0;

  const pieData = [
    { name: "Cash", value: totalCash },
    { name: "UPI", value: totalUpi },
  ];

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Reports</h1>
        <p className="text-[#8A7D71] text-sm mt-1">Business performance overview</p>
      </div>

      {/* Date range controls */}
      <div className="bg-white rounded-2xl border border-amber-900/10 p-4 mb-6 flex flex-wrap items-center gap-3 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        <div className="flex gap-2">
          {[{ label: "7D", val: 7 }, { label: "14D", val: 14 }, { label: "30D", val: 30 }].map(({ label, val }) => (
            <button key={val} onClick={() => applyPreset(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === String(val) ? "bg-[#8B5A2B] text-white" : "bg-[#F6F3EC] text-[#5C4F43] hover:bg-[#8B5A2B]/10"
              }`}
              data-testid={`range-${label}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setRange("custom"); }}
            className="rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
            data-testid="report-from-date" />
          <span className="text-[#8A7D71] text-sm">to</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setRange("custom"); }}
            className="rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
            data-testid="report-to-date" />
        </div>
      </div>

      {loading ? (
        <div className="text-center text-[#8A7D71] py-20">Loading...</div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Revenue", value: `₹${totalRev.toLocaleString("en-IN")}`, color: "#8B5A2B" },
              { label: "Total Walk-ins", value: totalWalkins, color: "#3E5C46" },
              { label: "Total Bills", value: totalBills, color: "#D48B3D" },
              { label: "Avg Bill Value", value: `₹${avgBill}`, color: "#C06C4C" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]"
                data-testid={`report-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <p className="text-xs text-[#8A7D71] uppercase tracking-wider mb-2">{s.label}</p>
                <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
              <h2 className="text-base font-semibold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Revenue Trend</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmt} tick={{ fontSize: 11, fill: "#8A7D71" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#8A7D71" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip formatter={(v) => `₹${v}`} />
                  <Bar dataKey="revenue" fill="#8B5A2B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
              <h2 className="text-base font-semibold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Payment Split</h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false} fontSize={11}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `₹${v.toLocaleString("en-IN")}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-[#5C4F43]">Cash</span>
                  <span className="font-semibold text-[#2C241B]">₹{totalCash.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#5C4F43]">UPI</span>
                  <span className="font-semibold text-[#2C241B]">₹{totalUpi.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Day-by-day table */}
          <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
            <div className="px-5 py-4 border-b border-amber-900/10">
              <h2 className="text-base font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Day-by-Day</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-900/10">
                    {["Date", "Walk-ins", "Bills", "Revenue", "Cash", "UPI", "Avg/Bill"].map((h) => (
                      <th key={h} className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slice().reverse().map((row) => (
                    <tr key={row.date} className="border-b border-amber-900/5 hover:bg-[#8B5A2B]/5 transition-colors">
                      <td className="px-5 py-3 font-medium text-[#2C241B]">{fmt(row.date)}</td>
                      <td className="px-5 py-3 text-[#5C4F43]">{row.walkins}</td>
                      <td className="px-5 py-3 text-[#5C4F43]">{row.bills}</td>
                      <td className="px-5 py-3 font-bold text-[#8B5A2B]">₹{row.revenue.toLocaleString("en-IN")}</td>
                      <td className="px-5 py-3 text-[#5C4F43]">₹{row.cash.toLocaleString("en-IN")}</td>
                      <td className="px-5 py-3 text-[#5C4F43]">₹{row.upi.toLocaleString("en-IN")}</td>
                      <td className="px-5 py-3 text-[#8A7D71]">₹{row.bills ? (row.revenue / row.bills).toFixed(0) : 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
