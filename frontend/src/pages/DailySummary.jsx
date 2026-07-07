import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { toast } from "sonner";
import { Printer, Download, ChevronLeft, ChevronRight, Receipt, Package, IndianRupee, Wallet } from "lucide-react";
import ThemeDatePicker from "../components/ThemeDatePicker";
import { downloadCsv } from "../utils/csv";
import { printDailySummary } from "../utils/dailySummaryPrint";

// Format using LOCAL date components — toISOString() converts to UTC, which
// shifts the date by a day in timezones ahead of UTC (e.g. IST) and breaks
// day-by-day arithmetic around local midnight.
function toLocalYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const todayStr = () => toLocalYMD(new Date());
const money = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n) => (Number(n) || 0).toLocaleString("en-IN");

const CAT_COLORS = ["#8B5A2B", "#3E5C46", "#D48B3D", "#C06C4C", "#6B4E7A", "#4C7A9E", "#A6803A", "#7A5C46"];

export default function DailySummary() {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/dashboard/daily-summary?date_str=${date}`);
        setData(data);
      } catch {
        toast.error("Failed to load daily summary");
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [date]);

  const shiftDay = (delta) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const next = toLocalYMD(d);
    if (next > todayStr()) return;
    setDate(next);
  };

  const b = data?.breakup || {};
  const cats = data?.categories || [];
  const isToday = date === todayStr();
  const hasData = data && data.bills > 0;

  const exportCsv = () => {
    if (!hasData) { toast.error("No data to export"); return; }
    const rows = [];
    cats.forEach((c) => {
      c.items.forEach((it) => rows.push({ category: c.category, item: it.name, qty: it.count, amount: it.amount, pct: "" }));
      rows.push({ category: c.category, item: "— Category Total —", qty: c.qty, amount: c.total, pct: c.percent });
    });
    downloadCsv(`dejabrew-daily-summary-${date}.csv`, rows, [
      { key: "category", label: "Category" },
      { key: "item", label: "Item" },
      { key: "qty", label: "Qty" },
      { key: "amount", label: "Amount", format: (v) => (Number(v) || 0).toFixed(2) },
      { key: "pct", label: "Category %", format: (v) => (v === "" ? "" : `${v}%`) },
    ]);
    toast.success("CSV exported");
  };

  const doPrint = () => {
    if (!hasData) { toast.error("Nothing to print"); return; }
    printDailySummary(data);
  };

  const KPIS = [
    { label: "Bills", value: num(data?.bills), icon: Receipt, color: "#8B5A2B" },
    { label: "Items Sold", value: num(data?.totals?.qty), icon: Package, color: "#3E5C46" },
    { label: "Net Sales (with tax)", value: money(b.net_with_tax), icon: IndianRupee, color: "#D48B3D" },
    { label: "Cash / UPI", value: `${money(b.cash)} · ${money(b.upi)}`, icon: Wallet, color: "#C06C4C", small: true },
  ];

  const BREAKUP_ROWS = [
    ["Cash", b.cash],
    ["Card / UPI", b.upi],
    ["Cash + Card", b.collected, "rule"],
    ["Gross (w/o Discount)", b.gross],
    ["Customer Discount", b.total_discount],
    ["Complementary", b.complementary],
    ["Net Sales Without Tax", b.net_without_tax, "rule"],
    ["CGST", b.cgst],
    ["SGST", b.sgst],
    ...(b.service_charge ? [["Service Charge", b.service_charge]] : []),
    ["Tax Amount", b.tax],
    ["Round Off", b.round_off],
  ];

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Daily Summary</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Category-wise sales &amp; end-of-day breakup</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white rounded-xl border border-amber-900/10 p-1 shadow-[0_2px_8px_rgba(44,36,27,0.04)]">
            <button onClick={() => shiftDay(-1)} className="p-1.5 rounded-lg text-[#5C4F43] hover:bg-[#8B5A2B]/10" data-testid="ds-prev-day" title="Previous day">
              <ChevronLeft size={16} />
            </button>
            <ThemeDatePicker value={date} onChange={setDate} max={todayStr()} testid="ds-date" className="border-0 shadow-none" />
            <button onClick={() => shiftDay(1)} disabled={isToday}
              className="p-1.5 rounded-lg text-[#5C4F43] hover:bg-[#8B5A2B]/10 disabled:opacity-30 disabled:hover:bg-transparent" data-testid="ds-next-day" title="Next day">
              <ChevronRight size={16} />
            </button>
          </div>
          {!isToday && (
            <button onClick={() => setDate(todayStr())} className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-amber-900/10 text-[#5C4F43] hover:text-[#8B5A2B]" data-testid="ds-today">
              Today
            </button>
          )}
          <button onClick={doPrint}
            className="flex items-center gap-2 bg-[#8B5A2B] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]" data-testid="ds-print">
            <Printer size={14} /> Print / PDF
          </button>
          <button onClick={exportCsv}
            className="flex items-center gap-2 bg-[#3E5C46] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#2F4735]" data-testid="ds-csv">
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-[#8A7D71] py-20">Loading...</div>
      ) : !hasData ? (
        <div className="bg-white rounded-2xl border border-amber-900/10 p-12 shadow-[0_4px_24px_rgba(44,36,27,0.04)] text-center">
          <p className="text-[#8A7D71] text-sm">No sales recorded on {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}.</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {KPIS.map((k) => (
              <div key={k.label} className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
                <div className="flex items-center gap-2 mb-2">
                  <k.icon size={15} style={{ color: k.color }} />
                  <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest font-medium">{k.label}</p>
                </div>
                <p className={`${k.small ? "text-base" : "text-2xl"} font-bold`} style={{ color: k.color, fontFamily: "Outfit, sans-serif" }}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Category breakdown */}
            <div className="lg:col-span-2 space-y-4">
              {cats.map((c, ci) => {
                const color = CAT_COLORS[ci % CAT_COLORS.length];
                return (
                  <div key={c.category} className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)] overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-amber-900/10" style={{ background: "#FBF8F2" }}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                        <h3 className="font-semibold text-[#2C241B] truncate" style={{ fontFamily: "Outfit, sans-serif" }}>{c.category}</h3>
                        <span className="text-[10px] text-[#8A7D71] font-medium">{num(c.qty)} qty</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>{(Number(c.percent) || 0).toFixed(2)}%</span>
                        <span className="font-bold text-[#2C241B]">{money(c.total)}</span>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {c.items.map((it) => (
                          <tr key={it.name} className="border-b border-amber-900/5 last:border-0">
                            <td className="px-5 py-2 text-[#3D342B]">{it.name}</td>
                            <td className="px-3 py-2 text-right text-[#8A7D71] w-16">{num(it.count)}</td>
                            <td className="px-5 py-2 text-right font-medium text-[#2C241B] w-28">{money(it.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* Breakup + payment summary */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
                <h2 className="font-semibold text-[#2C241B] mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Sales Breakup</h2>
                <div className="space-y-1.5">
                  {BREAKUP_ROWS.map(([label, val, cls]) => (
                    <div key={label} className={`flex justify-between text-sm ${cls === "rule" ? "pt-1.5 mt-1.5 border-t border-dashed border-amber-900/20" : ""}`}>
                      <span className="text-[#5C4F43]">{label}</span>
                      <span className="font-medium text-[#2C241B] tabular-nums">{money(val)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2.5 mt-2 border-t-2 border-[#2C241B]/80">
                    <span className="font-bold text-[#2C241B]">Net Sales With Tax</span>
                    <span className="font-bold text-[#8B5A2B] tabular-nums" style={{ fontFamily: "Outfit, sans-serif" }}>{money(b.net_with_tax)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
                <h2 className="font-semibold text-[#2C241B] mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Payment Summary</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] text-[#8A7D71] uppercase tracking-wider">
                      <th className="text-left font-medium pb-2">Mode</th>
                      <th className="text-right font-medium pb-2">Bills</th>
                      <th className="text-right font-medium pb-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.payment_modes || []).map((p) => (
                      <tr key={p.mode} className="border-t border-amber-900/5">
                        <td className="py-2 text-[#3D342B]">{p.label}</td>
                        <td className="py-2 text-right text-[#8A7D71]">{num(p.bills)}</td>
                        <td className="py-2 text-right font-medium text-[#2C241B] tabular-nums">{money(p.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-[#2C241B]/70">
                      <td className="py-2 font-bold text-[#2C241B]">Grand Total</td>
                      <td className="py-2 text-right font-bold text-[#2C241B]">{num(data.bills)}</td>
                      <td className="py-2 text-right font-bold text-[#8B5A2B] tabular-nums">{money(b.net_with_tax)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
