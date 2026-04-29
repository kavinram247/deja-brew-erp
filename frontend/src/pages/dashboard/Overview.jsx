import React, { useState, useEffect, useMemo } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Coffee, Download, FileText } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import DateRangeToolbar from "../../components/DateRangeToolbar";
import { shiftYMD } from "../../utils/date";
import { downloadCsv } from "../../utils/csv";
import { downloadPdf } from "../../utils/pdf";

function DeltaBadge({ current, prev }) {
  if (!prev || prev === 0) return null;
  const pct = ((current - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 ${up ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {up ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function sumRows(rows) {
  return rows.reduce((acc, r) => ({
    offline: acc.offline + r.offline_revenue,
    online: acc.online + r.online_revenue,
    total: acc.total + r.total_revenue,
    bills: acc.bills + r.bills,
    walkins: acc.walkins + r.walkins,
    guests: acc.guests + r.guests,
    cash: acc.cash + r.cash,
    upi: acc.upi + r.upi,
  }), { offline: 0, online: 0, total: 0, bills: 0, walkins: 0, guests: 0, cash: 0, upi: 0 });
}

export default function Overview() {
  const todayStr = new Date().toISOString().split("T")[0];
  const [range, setRange] = useState({ preset: "today", from: todayStr, to: todayStr });
  const [rows, setRows] = useState([]);
  const [compRows, setCompRows] = useState([]);
  const [discountStats, setDiscountStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const spanDays = Math.round((new Date(range.to) - new Date(range.from)) / 86400000) + 1;
        const compareEnd = shiftYMD(range.from, -1);
        const compareStart = shiftYMD(compareEnd, -(spanDays - 1));

        const [analyticsRes, discountRes] = await Promise.all([
          api.get(`/dashboard/analytics?from_date=${range.from}&to_date=${range.to}&compare_from=${compareStart}&compare_to=${compareEnd}`),
          api.get(`/dashboard/discount-stats?from_date=${range.from}&to_date=${range.to}`),
        ]);
        setRows(analyticsRes.data.current || []);
        setCompRows(analyticsRes.data.comparison || []);
        setDiscountStats(discountRes.data);
      } catch { toast.error("Failed to load analytics"); }
      finally { setLoading(false); }
    })();
  }, [range.from, range.to]);

  const totals = useMemo(() => sumRows(rows), [rows]);
  const compTotals = useMemo(() => sumRows(compRows), [compRows]);

  const aov = totals.bills > 0 ? totals.offline / totals.bills : 0;
  const compAov = compTotals.bills > 0 ? compTotals.offline / compTotals.bills : 0;
  const avgParty = totals.walkins > 0 ? totals.guests / totals.walkins : 0;
  const compAvgParty = compTotals.walkins > 0 ? compTotals.guests / compTotals.walkins : 0;
  const revPP = totals.guests > 0 ? totals.offline / totals.guests : 0;
  const compRevPP = compTotals.guests > 0 ? compTotals.offline / compTotals.guests : 0;

  const platformAgg = useMemo(() => {
    const m = {};
    rows.forEach((r) => {
      Object.entries(r.platforms || {}).forEach(([p, v]) => { m[p] = (m[p] || 0) + v; });
    });
    return m;
  }, [rows]);

  const insights = useMemo(() => {
    const result = [];
    if (compTotals.total > 0) {
      const delta = ((totals.total - compTotals.total) / compTotals.total) * 100;
      if (Math.abs(delta) >= 10)
        result.push(delta > 0 ? `Revenue up ${delta.toFixed(1)}% vs previous period` : `Revenue down ${Math.abs(delta).toFixed(1)}% vs previous period`);
    }
    if (compAov > 0) {
      const delta = ((aov - compAov) / compAov) * 100;
      if (Math.abs(delta) >= 10)
        result.push(delta > 0 ? `Avg order value up ${delta.toFixed(1)}%` : `Avg order value down ${Math.abs(delta).toFixed(1)}%`);
    }
    if (discountStats?.total_bills > 0) {
      const scPct = (discountStats.service_charge_count / discountStats.total_bills) * 100;
      if (scPct >= 50) result.push(`Service charge applied to ${scPct.toFixed(0)}% of bills`);
    }
    return result.slice(0, 3);
  }, [totals, compTotals, aov, compAov, discountStats]);

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
    ]);
    toast.success(`Exported ${rows.length} day(s)`);
  };

  const exportPdf = async () => {
    if (rows.length === 0) { toast.error("No data to export"); return; }
    await downloadPdf(rows, [
      { key: "date", label: "Date" },
      { key: "offline_revenue", label: "Offline ₹", format: (v) => (v || 0).toLocaleString("en-IN") },
      { key: "online_revenue", label: "Online ₹", format: (v) => (v || 0).toLocaleString("en-IN") },
      { key: "total_revenue", label: "Total ₹", format: (v) => (v || 0).toLocaleString("en-IN") },
      { key: "bills", label: "Bills" },
      { key: "walkins", label: "Walk-ins" },
      { key: "guests", label: "Guests" },
      { key: "cash", label: "Cash ₹", format: (v) => (v || 0).toLocaleString("en-IN") },
      { key: "upi", label: "UPI ₹", format: (v) => (v || 0).toLocaleString("en-IN") },
    ], {
      filename: `dejabrew-overview-${range.from}_to_${range.to}.pdf`,
      title: "Business Overview",
      subtitle: rangeLabel,
      summaryLines: [
        { label: "Total Revenue", value: `₹${totals.total.toLocaleString("en-IN")}` },
        { label: "Offline / Online", value: `₹${totals.offline.toLocaleString("en-IN")} / ₹${totals.online.toLocaleString("en-IN")}` },
        { label: "Bills / Walk-ins", value: `${totals.bills} / ${totals.walkins} (${totals.guests} guests)` },
        { label: "Cash / UPI", value: `₹${totals.cash.toLocaleString("en-IN")} / ₹${totals.upi.toLocaleString("en-IN")}` },
      ],
    });
    toast.success("PDF ready");
  };

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Overview</h1>
          <p className="text-[#8A7D71] text-sm mt-1">{rangeLabel} · business insights</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeToolbar {...range} onChange={setRange} />
          <button onClick={exportCsv}
            className="flex items-center gap-2 bg-[#3E5C46] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#2F4735]"
            data-testid="export-overview-csv">
            <Download size={14} /> CSV
          </button>
          <button onClick={exportPdf}
            className="flex items-center gap-2 bg-[#8B5A2B] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]"
            data-testid="export-overview-pdf">
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-[#8A7D71] py-20">
          <Coffee className="mx-auto animate-pulse text-[#8B5A2B] mb-2" /> Loading...
        </div>
      ) : (
        <>
          {/* 6 KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {[
              { label: "Revenue", value: `₹${totals.total.toLocaleString("en-IN")}`, cur: totals.total, prev: compTotals.total, color: "#8B5A2B", testid: "stat-total-revenue" },
              { label: "Bills", value: totals.bills, cur: totals.bills, prev: compTotals.bills, color: "#3E5C46", testid: "stat-bills" },
              { label: "Walk-ins", value: totals.walkins, cur: totals.walkins, prev: compTotals.walkins, color: "#D48B3D", testid: "stat-walkins" },
              { label: "AOV", value: aov > 0 ? `₹${aov.toFixed(0)}` : "—", cur: aov, prev: compAov, color: "#C06C4C", testid: "stat-aov", sub: "avg order value" },
              { label: "Avg Party", value: avgParty > 0 ? avgParty.toFixed(1) : "—", cur: avgParty, prev: compAvgParty, color: "#8B5A2B", testid: "stat-party", sub: "guests / walk-in" },
              { label: "Rev / Person", value: revPP > 0 ? `₹${revPP.toFixed(0)}` : "—", cur: revPP, prev: compRevPP, color: "#3E5C46", testid: "stat-revpp" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid={s.testid}>
                <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest font-medium">{s.label}</p>
                <div className="flex items-baseline gap-1 mt-1 flex-wrap">
                  <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
                  <DeltaBadge current={s.cur} prev={s.prev} />
                </div>
                {s.sub && <p className="text-xs text-[#8A7D71] mt-1">{s.sub}</p>}
              </div>
            ))}
          </div>

          {/* Insight strip */}
          {insights.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-6 flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider shrink-0">Insights</span>
              {insights.map((ins, i) => (
                <span key={i} className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-medium">{ins}</span>
              ))}
            </div>
          )}

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
                  <Line type="monotone" dataKey="offline_revenue" stroke="#8B5A2B" strokeWidth={2} name="Offline" dot={false} />
                  <Line type="monotone" dataKey="online_revenue" stroke="#D48B3D" strokeWidth={2} name="Online" dot={false} />
                  <Line type="monotone" dataKey="total_revenue" stroke="#3E5C46" strokeWidth={2.5} name="Total" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Discount summary */}
          {discountStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
                <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest font-medium mb-1">Discounts Given</p>
                <p className="text-2xl font-bold text-[#B84B4B]" style={{ fontFamily: "Outfit, sans-serif" }}>
                  ₹{(discountStats.total_overall_discount || 0).toLocaleString("en-IN")}
                </p>
                {discountStats.gross_subtotal > 0 && (
                  <p className="text-xs text-[#8A7D71] mt-1">
                    {((discountStats.total_overall_discount / discountStats.gross_subtotal) * 100).toFixed(1)}% of gross subtotal
                  </p>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
                <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest font-medium mb-1">Service Charge</p>
                <p className="text-2xl font-bold text-[#3E5C46]" style={{ fontFamily: "Outfit, sans-serif" }}>
                  {discountStats.total_bills > 0
                    ? `${((discountStats.service_charge_count / discountStats.total_bills) * 100).toFixed(0)}%`
                    : "—"}
                </p>
                <p className="text-xs text-[#8A7D71] mt-1">
                  {discountStats.service_charge_count} of {discountStats.total_bills} bills · ₹{(discountStats.total_service_charge || 0).toLocaleString("en-IN")} total
                </p>
              </div>
            </div>
          )}

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
