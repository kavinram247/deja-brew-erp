import React, { useState, useEffect, useMemo } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Download, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import DateRangeToolbar from "../../components/DateRangeToolbar";
import { downloadCsv } from "../../utils/csv";
import { downloadPdf } from "../../utils/pdf";

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const BADGE_COLOR = { STAR: "#D48B3D", WORKHORSE: "#3E5C46", DEAD: "#C9B99A" };

export default function DSales() {
  const today = new Date().toISOString().split("T")[0];
  const [range, setRange] = useState({ preset: "month", from: "", to: today });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("revenue");

  useEffect(() => {
    if (!range.from) {
      setRange({ preset: "month", from: today.slice(0, 8) + "01", to: today });
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/dashboard/top-items?from_date=${range.from}&to_date=${range.to}`);
        setItems(data);
      } catch { toast.error("Failed"); }
      finally { setLoading(false); }
    })();
  }, [range.from, range.to]); // eslint-disable-line

  const classified = useMemo(() => {
    if (!items.length) return [];
    const revMedian = median(items.map((i) => i.revenue));
    const qtyMedian = median(items.map((i) => i.quantity_sold));
    return items.map((item) => {
      let badge;
      if (item.revenue > revMedian && item.quantity_sold > qtyMedian) badge = "STAR";
      else if (item.quantity_sold > qtyMedian) badge = "WORKHORSE";
      else badge = "DEAD";
      return { ...item, badge, avg_price: item.quantity_sold > 0 ? item.revenue / item.quantity_sold : 0 };
    });
  }, [items]);

  const sorted = useMemo(() => (
    [...classified].sort((a, b) => sortBy === "revenue" ? b.revenue - a.revenue : b.quantity_sold - a.quantity_sold)
  ), [classified, sortBy]);

  const topRevenue = classified.reduce((m, i) => i.revenue > (m?.revenue || 0) ? i : m, null);
  const topQty = classified.reduce((m, i) => i.quantity_sold > (m?.quantity_sold || 0) ? i : m, null);
  const topAvg = classified.reduce((m, i) => i.avg_price > (m?.avg_price || 0) ? i : m, null);

  const exportCsv = () => {
    if (!items.length) { toast.error("No data to export"); return; }
    downloadCsv(`dejabrew-items-${range.from}_to_${range.to}.csv`, classified, [
      { key: "name", label: "Item" },
      { key: "quantity_sold", label: "Qty Sold" },
      { key: "revenue", label: "Revenue" },
      { key: "avg_price", label: "Avg Price", format: (v) => v.toFixed(2) },
      { key: "badge", label: "Category" },
    ]);
    toast.success(`Exported ${items.length} item(s)`);
  };

  const exportPdf = async () => {
    if (!items.length) { toast.error("No data to export"); return; }
    await downloadPdf(sorted, [
      { key: "name", label: "Item" },
      { key: "quantity_sold", label: "Qty" },
      { key: "revenue", label: "Revenue ₹", format: (v) => (v || 0).toLocaleString("en-IN") },
      { key: "avg_price", label: "Avg ₹", format: (v) => (v || 0).toFixed(2) },
      { key: "badge", label: "Category" },
    ], {
      filename: `dejabrew-items-${range.from}_to_${range.to}.pdf`,
      title: "Top Items Report",
      subtitle: `${range.from} → ${range.to}`,
      summaryLines: [
        { label: "Items tracked", value: `${items.length}` },
        { label: "Top revenue", value: topRevenue ? `${topRevenue.name} (₹${topRevenue.revenue.toLocaleString("en-IN")})` : "—" },
        { label: "Top qty", value: topQty ? `${topQty.name} (${topQty.quantity_sold} sold)` : "—" },
      ],
    });
    toast.success("PDF ready");
  };

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Top Items</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Menu performance analysis</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeToolbar {...range} onChange={setRange} />
          <div className="flex rounded-xl overflow-hidden border border-amber-900/20">
            <button onClick={() => setSortBy("revenue")}
              className={`px-3 py-2 text-xs font-semibold transition-colors ${sortBy === "revenue" ? "bg-[#8B5A2B] text-white" : "bg-white text-[#5C4F43] hover:bg-[#F6F3EC]"}`}>
              Revenue
            </button>
            <button onClick={() => setSortBy("quantity")}
              className={`px-3 py-2 text-xs font-semibold transition-colors ${sortBy === "quantity" ? "bg-[#8B5A2B] text-white" : "bg-white text-[#5C4F43] hover:bg-[#F6F3EC]"}`}>
              Quantity
            </button>
          </div>
          <button onClick={exportCsv}
            className="flex items-center gap-2 bg-[#3E5C46] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#2F4735]"
            data-testid="export-items-csv">
            <Download size={14} /> CSV
          </button>
          <button onClick={exportPdf}
            className="flex items-center gap-2 bg-[#8B5A2B] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]"
            data-testid="export-items-pdf">
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      {loading ? <div className="text-center text-[#8A7D71] py-20">Loading...</div> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
              <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest font-medium">Top by Revenue</p>
              <p className="text-xl font-bold text-[#8B5A2B] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>{topRevenue?.name || "—"}</p>
              {topRevenue && <p className="text-xs text-[#8A7D71] mt-1">₹{topRevenue.revenue.toLocaleString("en-IN")}</p>}
            </div>
            <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
              <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest font-medium">Top by Quantity</p>
              <p className="text-xl font-bold text-[#3E5C46] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>{topQty?.name || "—"}</p>
              {topQty && <p className="text-xs text-[#8A7D71] mt-1">{topQty.quantity_sold} sold</p>}
            </div>
            <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
              <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest font-medium">Highest Avg Price</p>
              <p className="text-xl font-bold text-[#D48B3D] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>{topAvg?.name || "—"}</p>
              {topAvg && <p className="text-xs text-[#8A7D71] mt-1">₹{topAvg.avg_price.toFixed(2)} avg</p>}
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="bg-white rounded-2xl border border-amber-900/10 p-12 shadow-[0_4px_24px_rgba(44,36,27,0.04)] text-center">
              <p className="text-[#8A7D71] text-sm">No items sold in this range</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-amber-900/10 p-6 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Item Performance</h2>
                <div className="flex items-center gap-3">
                  {[["STAR", "#D48B3D"], ["WORKHORSE", "#3E5C46"], ["DEAD", "#C9B99A"]].map(([label, color]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      <span className="text-[10px] text-[#8A7D71] font-medium">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={Math.min(800, Math.max(300, sorted.length * 32))}>
                <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD1" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#8A7D71", fontSize: 11 }}
                    tickFormatter={(v) => sortBy === "revenue" ? `₹${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fill: "#2C241B", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#FFF", border: "1px solid #E8DFD1", borderRadius: 12 }}
                    formatter={(v) => [
                      sortBy === "revenue" ? `₹${v.toLocaleString("en-IN")}` : `${v} sold`,
                      sortBy === "revenue" ? "Revenue" : "Quantity",
                    ]}
                  />
                  <Bar dataKey={sortBy === "revenue" ? "revenue" : "quantity_sold"} radius={[0, 4, 4, 0]}>
                    {sorted.map((item, i) => (
                      <Cell key={i} fill={BADGE_COLOR[item.badge]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
