import React, { useState, useEffect, useMemo } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Wallet, Filter, Download, FileText, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import DateRangeToolbar, { computeRange } from "../../components/DateRangeToolbar";
import { downloadCsv } from "../../utils/csv";
import { downloadPdf } from "../../utils/pdf";

const CAT_COLORS = {
  "Raw Materials": "#8B5A2B",
  "Consumables": "#D48B3D",
  "Utilities": "#3E5C46",
  "Staff": "#C06C4C",
  "Maintenance": "#5C4F43",
  "Other": "#8A7D71",
};

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export default function DPurchases() {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split("T")[0]; })();
  const [range, setRange] = useState({ preset: "week", from: weekAgo, to: today });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("All");
  const [expanded, setExpanded] = useState({});

  const toggleDay = (date) => setExpanded((p) => ({ ...p, [date]: !p[date] }));

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const { data } = await api.get("/float/history"); setHistory(data); }
      catch { toast.error("Failed"); }
      finally { setLoading(false); }
    })();
  }, []);

  // Filter history by range
  const filtered = useMemo(() => {
    return history.filter((h) => h.date >= range.from && h.date <= range.to);
  }, [history, range.from, range.to]);

  // Flatten expenses within range
  const expenses = useMemo(() => {
    const out = [];
    filtered.forEach((h) => {
      (h.expenses || []).forEach((e) => {
        out.push({ ...e, date: h.date });
      });
    });
    return out.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  }, [filtered]);

  const expensesShown = catFilter === "All" ? expenses : expenses.filter((e) => e.category === catFilter);

  const totalSpent = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const daysTracked = filtered.length;
  const avgPerDay = daysTracked > 0 ? totalSpent / daysTracked : 0;

  const catMap = {};
  expenses.forEach((e) => { catMap[e.category] = (catMap[e.category] || 0) + (e.amount || 0); });
  const cats = ["All", ...Object.keys(catMap).sort()];

  const exportCsv = () => {
    if (expensesShown.length === 0) { toast.error("No expenses in range"); return; }
    downloadCsv(`dejabrew-purchases-${range.from}_to_${range.to}.csv`, expensesShown, [
      { key: "date", label: "Date" },
      { key: "timestamp", label: "Time", format: (v) => v ? new Date(v).toLocaleString("en-IN") : "" },
      { key: "description", label: "Description" },
      { key: "category", label: "Category" },
      { key: "amount", label: "Amount (₹)" },
    ]);
    toast.success(`Exported ${expensesShown.length} expense(s)`);
  };

  const exportPdf = async () => {
    if (expensesShown.length === 0) { toast.error("No expenses in range"); return; }
    await downloadPdf(expensesShown, [
      { key: "date", label: "Date" },
      { key: "timestamp", label: "Time", format: (v) => v ? fmtTime(v) : "" },
      { key: "description", label: "Description" },
      { key: "category", label: "Category" },
      { key: "amount", label: "₹", format: (v) => (v || 0).toLocaleString("en-IN") },
    ], {
      filename: `dejabrew-purchases-${range.from}_to_${range.to}.pdf`,
      title: "Purchases / Float Report",
      subtitle: `${range.from} → ${range.to}${catFilter !== "All" ? ` · ${catFilter}` : ""}`,
      summaryLines: [
        { label: "Days Tracked", value: daysTracked },
        { label: "Total Expenses", value: `${expenses.length} (showing ${expensesShown.length})` },
        { label: "Total Spent", value: `₹${totalSpent.toLocaleString("en-IN")}` },
        { label: "Avg per Day", value: `₹${avgPerDay.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` },
      ],
    });
    toast.success("PDF ready");
  };

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Purchases Analytics</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Petty cash expense breakdown</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeToolbar {...range} onChange={setRange} />
          <button onClick={exportCsv}
            className="flex items-center gap-2 bg-[#3E5C46] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#2F4735]"
            data-testid="export-purchases-csv">
            <Download size={14} /> CSV
          </button>
          <button onClick={exportPdf}
            className="flex items-center gap-2 bg-[#8B5A2B] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]"
            data-testid="export-purchases-pdf">
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      {loading ? <div className="text-center text-[#8A7D71] py-20">Loading...</div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Days Tracked", value: daysTracked, color: "#8B5A2B", testid: "dp-days" },
              { label: "Total Expenses", value: expenses.length, color: "#3E5C46", testid: "dp-expenses" },
              { label: "Total Spent", value: `₹${totalSpent.toLocaleString("en-IN")}`, color: "#B84B4B", testid: "dp-spent" },
              { label: "Avg / Day", value: `₹${avgPerDay.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "#D48B3D", testid: "dp-avg" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid={s.testid}>
                <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">{s.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: s.color, fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          <div className="bg-white rounded-2xl border border-amber-900/10 p-6 shadow-[0_4px_24px_rgba(44,36,27,0.04)] mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Spend by Category</h2>
              <span className="text-xs text-[#8A7D71]">Click a category to filter</span>
            </div>
            {Object.keys(catMap).length === 0 ? (
              <p className="text-[#8A7D71] text-center py-4 text-sm">No expenses in range</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([c, v]) => {
                  const pct = totalSpent > 0 ? (v / totalSpent) * 100 : 0;
                  const color = CAT_COLORS[c] || "#8B5A2B";
                  const isActive = catFilter === c;
                  return (
                    <button key={c} onClick={() => setCatFilter(isActive ? "All" : c)}
                      className={`w-full text-left transition-all ${isActive ? "opacity-100" : "opacity-90 hover:opacity-100"}`}
                      data-testid={`dp-cat-${c.toLowerCase().replace(/\s+/g, "-")}`}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={`font-medium ${isActive ? "text-[#8B5A2B]" : "text-[#2C241B]"}`}>
                          {isActive && "● "}{c}
                        </span>
                        <span className="text-[#8B5A2B] font-bold">₹{v.toLocaleString("en-IN")} · {pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-[#F6F3EC] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Expenses table — THE BREAKDOWN */}
          <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-amber-900/10">
              <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
                Expenses ({expensesShown.length}{catFilter !== "All" ? ` · ${catFilter}` : ""})
              </h2>
              <div className="flex gap-1.5 flex-wrap">
                {cats.map((c) => (
                  <button key={c} onClick={() => setCatFilter(c)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      catFilter === c ? "bg-[#8B5A2B] text-white" : "bg-[#F6F3EC] text-[#5C4F43] hover:bg-[#8B5A2B]/10"
                    }`}
                    data-testid={`dp-filter-${c.toLowerCase().replace(/\s+/g, "-")}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            {expensesShown.length === 0 ? (
              <div className="text-center py-12">
                <Wallet size={36} className="text-[#C9B99A] mx-auto mb-2" />
                <p className="text-[#8A7D71] text-sm">No expenses {catFilter !== "All" ? `in "${catFilter}"` : "in this range"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-amber-900/10">
                    {["Date", "Time", "Description", "Category", "Amount"].map((h) => (
                      <th key={h} className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {expensesShown.map((e) => {
                      const color = CAT_COLORS[e.category] || "#8B5A2B";
                      return (
                        <tr key={e.id} className="border-b border-amber-900/5 hover:bg-[#8B5A2B]/5" data-testid={`dp-exp-${e.id}`}>
                          <td className="px-5 py-3 text-[#2C241B] font-medium">{e.date}</td>
                          <td className="px-5 py-3 text-[#8A7D71] text-xs">{fmtTime(e.timestamp)}</td>
                          <td className="px-5 py-3 text-[#2C241B]">{e.description}</td>
                          <td className="px-5 py-3">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ background: `${color}15`, color }}>
                              {e.category}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-[#B84B4B]">−₹{e.amount.toLocaleString("en-IN")}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-[#F6F3EC] font-bold">
                      <td colSpan="4" className="px-5 py-3 text-[#2C241B]">Total</td>
                      <td className="px-5 py-3 text-right text-[#B84B4B]">
                        −₹{expensesShown.reduce((s, e) => s + (e.amount || 0), 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Daily summary with expandable expense items */}
          <div className="mt-6 bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
            <div className="px-5 py-4 border-b border-amber-900/10 flex items-center justify-between">
              <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Daily Float History</h2>
              <span className="text-xs text-[#8A7D71]">Click a date to see items</span>
            </div>
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-sm text-[#8A7D71]">No float data in range</div>
            ) : (
              <div className="divide-y divide-amber-900/5">
                {filtered.map((h) => {
                  const spent = h.opening_balance - h.closing_balance;
                  const isOpen = !!expanded[h.date];
                  const exp = h.expenses || [];
                  return (
                    <div key={h.id} data-testid={`dp-row-${h.date}`}>
                      <button onClick={() => toggleDay(h.date)}
                        className="w-full grid grid-cols-12 gap-2 items-center px-5 py-3 hover:bg-[#8B5A2B]/5 text-sm text-left"
                        data-testid={`dp-expand-${h.date}`}>
                        <div className="col-span-1 text-[#8B5A2B]">
                          {isOpen ? <ChevronDown size={15} /> : <ChevronRightIcon size={15} />}
                        </div>
                        <div className="col-span-3 font-semibold text-[#2C241B]">{h.date}</div>
                        <div className="col-span-2 text-[#5C4F43]">Open ₹{h.opening_balance}</div>
                        <div className={`col-span-2 font-semibold ${h.closing_balance < 1000 ? "text-[#B84B4B]" : "text-[#3E5C46]"}`}>Close ₹{h.closing_balance}</div>
                        <div className="col-span-2 text-[#B84B4B] font-semibold">−₹{spent.toFixed(0)}</div>
                        <div className="col-span-2 text-right text-xs text-[#8A7D71]">{exp.length} item{exp.length !== 1 ? "s" : ""}</div>
                      </button>
                      {isOpen && (
                        <div className="bg-[#F6F3EC]/60 px-5 py-3 fade-in" data-testid={`dp-items-${h.date}`}>
                          {exp.length === 0 ? (
                            <p className="text-xs text-[#8A7D71] italic text-center py-2">No expenses logged this day</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-amber-900/10">
                                  <th className="text-left text-[10px] text-[#8A7D71] uppercase tracking-wider py-1.5 px-2 font-medium">Time</th>
                                  <th className="text-left text-[10px] text-[#8A7D71] uppercase tracking-wider py-1.5 px-2 font-medium">Description</th>
                                  <th className="text-left text-[10px] text-[#8A7D71] uppercase tracking-wider py-1.5 px-2 font-medium">Category</th>
                                  <th className="text-right text-[10px] text-[#8A7D71] uppercase tracking-wider py-1.5 px-2 font-medium">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {exp.map((e) => {
                                  const color = CAT_COLORS[e.category] || "#8B5A2B";
                                  return (
                                    <tr key={e.id} className="border-b border-amber-900/5 last:border-0" data-testid={`dp-day-item-${e.id}`}>
                                      <td className="py-1.5 px-2 text-[#8A7D71]">{e.timestamp ? fmtTime(e.timestamp) : "—"}</td>
                                      <td className="py-1.5 px-2 text-[#2C241B]">{e.description}</td>
                                      <td className="py-1.5 px-2">
                                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: `${color}15`, color }}>
                                          {e.category}
                                        </span>
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-semibold text-[#B84B4B]">−₹{e.amount.toLocaleString("en-IN")}</td>
                                    </tr>
                                  );
                                })}
                                <tr className="font-bold">
                                  <td colSpan="3" className="py-1.5 px-2 text-[#2C241B]">Day Total</td>
                                  <td className="py-1.5 px-2 text-right text-[#B84B4B]">−₹{spent.toLocaleString("en-IN")}</td>
                                </tr>
                              </tbody>
                            </table>
                          )}
                          {h.notes && <p className="mt-2 text-xs italic text-[#8A7D71]">"{h.notes}"</p>}
                        </div>
                      )}
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
