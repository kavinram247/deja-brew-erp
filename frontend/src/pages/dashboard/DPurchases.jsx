import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Wallet, ChevronLeft, ChevronRight } from "lucide-react";
import DateRangeToolbar from "../../components/DateRangeToolbar";

export default function DPurchases() {
  const today = new Date().toISOString().split("T")[0];
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const { data } = await api.get("/float/history"); setHistory(data); }
      catch { toast.error("Failed"); }
      finally { setLoading(false); }
    })();
  }, []);

  const totalSpent = history.reduce((s, h) => s + (h.opening_balance - h.closing_balance), 0);
  const totalExpenses = history.reduce((s, h) => s + (h.expenses?.length || 0), 0);

  // Category breakdown
  const catMap = {};
  history.forEach((h) => {
    (h.expenses || []).forEach((e) => {
      catMap[e.category] = (catMap[e.category] || 0) + (e.amount || 0);
    });
  });

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Purchases Analytics</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Last 30 days of petty cash expenses</p>
        </div>
      </div>

      {loading ? <div className="text-center text-[#8A7D71] py-20">Loading...</div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="dp-days">
              <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">Days Tracked</p>
              <p className="text-2xl font-bold text-[#8B5A2B] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>{history.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="dp-expenses">
              <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">Total Expenses</p>
              <p className="text-2xl font-bold text-[#3E5C46] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>{totalExpenses}</p>
            </div>
            <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="dp-spent">
              <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">Total Spent</p>
              <p className="text-2xl font-bold text-[#B84B4B] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>₹{totalSpent.toLocaleString("en-IN")}</p>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="bg-white rounded-2xl border border-amber-900/10 p-6 shadow-[0_4px_24px_rgba(44,36,27,0.04)] mb-6">
            <h2 className="font-semibold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Spend by Category</h2>
            {Object.keys(catMap).length === 0 ? (
              <p className="text-[#8A7D71] text-center py-4 text-sm">No expenses yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([c, v]) => {
                  const pct = totalSpent > 0 ? (v / totalSpent) * 100 : 0;
                  return (
                    <div key={c} data-testid={`dp-cat-${c.toLowerCase().replace(/\s+/g, "-")}`}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[#2C241B] font-medium">{c}</span>
                        <span className="text-[#8B5A2B] font-bold">₹{v.toLocaleString("en-IN")} · {pct.toFixed(1)}%</span>
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

          {/* Daily log */}
          <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
            <div className="px-5 py-4 border-b border-amber-900/10">
              <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Daily Float History</h2>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-10">
                <Wallet size={36} className="text-[#C9B99A] mx-auto mb-2" />
                <p className="text-[#8A7D71] text-sm">No history yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-amber-900/10">
                    {["Date", "Opening", "Closing", "Spent", "#Expenses"].map((h) => (
                      <th key={h} className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-b border-amber-900/5 hover:bg-[#8B5A2B]/5 transition-colors" data-testid={`dp-row-${h.date}`}>
                        <td className="px-5 py-3 font-medium text-[#2C241B]">{h.date}</td>
                        <td className="px-5 py-3 text-[#5C4F43]">₹{h.opening_balance}</td>
                        <td className={`px-5 py-3 font-semibold ${h.closing_balance < 1000 ? "text-[#B84B4B]" : "text-[#3E5C46]"}`}>₹{h.closing_balance}</td>
                        <td className="px-5 py-3 text-[#B84B4B] font-semibold">−₹{(h.opening_balance - h.closing_balance).toFixed(0)}</td>
                        <td className="px-5 py-3 text-[#8A7D71]">{h.expenses?.length || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
