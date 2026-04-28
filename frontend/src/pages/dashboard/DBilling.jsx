import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Receipt, ChevronLeft, ChevronRight, Eye, X, Download, FileText } from "lucide-react";
import ThemeDatePicker from "../../components/ThemeDatePicker";
import { todayYMD, shiftYMD } from "../../utils/date";
import { downloadCsv } from "../../utils/csv";
import { downloadPdf } from "../../utils/pdf";

function fmt(iso) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export default function DBilling() {
  const today = todayYMD();
  const [date, setDate] = useState(today);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBill, setShowBill] = useState(null);

  const load = async (d = date) => {
    setLoading(true);
    try { const { data } = await api.get(`/bills?date_str=${d}`); setBills(data); }
    catch { toast.error("Failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(date); }, [date]); // eslint-disable-line

  const changeDate = (delta) => {
    setDate(shiftYMD(date, delta));
  };

  const totalRev = bills.reduce((s, b) => s + b.total, 0);
  const totalCash = bills.reduce((s, b) => s + (b.cash_amount || 0), 0);
  const totalUpi = bills.reduce((s, b) => s + (b.upi_amount || 0), 0);

  const exportCsv = () => {
    if (bills.length === 0) { toast.error("No bills to export"); return; }
    downloadCsv(`dejabrew-bills-${date}.csv`, bills, [
      { key: "bill_number", label: "Bill No" },
      { key: "created_at", label: "Time", format: (v) => v ? new Date(v).toLocaleString("en-IN") : "" },
      { key: "customer_name", label: "Customer" },
      { key: "customer_phone", label: "Phone" },
      { key: "items", label: "Items", format: (v) => (v || []).map((i) => `${i.name}×${i.quantity}`).join(" | ") },
      { key: "subtotal", label: "Subtotal" },
      { key: "overall_discount", label: "Discount" },
      { key: "cgst", label: "CGST" },
      { key: "sgst", label: "SGST" },
      { key: "total", label: "Total" },
      { key: "payment_mode", label: "Payment" },
      { key: "cash_amount", label: "Cash" },
      { key: "upi_amount", label: "UPI" },
    ]);
    toast.success(`Exported ${bills.length} bill(s)`);
  };

  const exportPdf = () => {
    if (bills.length === 0) { toast.error("No bills to export"); return; }
    const cols = [
      { key: "bill_number", label: "Bill No" },
      { key: "created_at", label: "Time", format: (v) => v ? fmt(v) : "" },
      { key: "customer_name", label: "Customer" },
      { key: "items", label: "Items", format: (v) => (v || []).map((i) => `${i.name}×${i.quantity}`).join(", ") },
      { key: "payment_mode", label: "Pay", format: (v) => v === "cash+upi" ? "Split" : (v || "").toUpperCase() },
      { key: "total", label: "Total ₹", format: (v) => (v || 0).toFixed(2) },
    ];
    downloadPdf(bills, cols, {
      filename: `dejabrew-bills-${date}.pdf`,
      title: "Billing Report",
      subtitle: date === today ? "Today" : date,
      summaryLines: [
        { label: "Bills", value: `${bills.length} (₹${totalRev.toLocaleString("en-IN")})` },
        { label: "Cash / UPI", value: `₹${totalCash.toLocaleString("en-IN")} / ₹${totalUpi.toLocaleString("en-IN")}` },
      ],
    });
    toast.success("PDF ready");
  };

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Billing</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Read-only bill history · {date === today ? "Today" : date}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"><ChevronLeft size={16} /></button>
          <ThemeDatePicker value={date} onChange={setDate} max={today} testid="dbilling-date" />
          <button onClick={() => changeDate(1)} disabled={date >= today} className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10 disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
          <button onClick={exportCsv}
            className="flex items-center gap-2 ml-1 bg-[#3E5C46] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#2F4735]"
            data-testid="export-bills-csv">
            <Download size={14} /> CSV
          </button>
          <button onClick={exportPdf}
            className="flex items-center gap-2 bg-[#8B5A2B] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]"
            data-testid="export-bills-pdf">
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Bills", value: bills.length, color: "#3E5C46", testid: "db-active" },
          { label: "Revenue", value: `₹${totalRev.toLocaleString("en-IN")}`, color: "#8B5A2B", testid: "db-revenue" },
          { label: "Cash", value: `₹${totalCash.toLocaleString("en-IN")}`, color: "#D48B3D", testid: "db-cash" },
          { label: "UPI", value: `₹${totalUpi.toLocaleString("en-IN")}`, color: "#C06C4C", testid: "db-upi" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid={s.testid}>
            <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color, fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        <div className="px-5 py-4 border-b border-amber-900/10">
          <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
            {bills.length} bill{bills.length !== 1 ? "s" : ""}
          </h2>
        </div>
        {loading ? <div className="text-center text-[#8A7D71] py-10">Loading...</div>
          : bills.length === 0 ? (
            <div className="text-center py-12">
              <Receipt size={36} className="text-[#C9B99A] mx-auto mb-2" />
              <p className="text-[#8A7D71] text-sm">No bills on this date</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-amber-900/10">
                  {["Bill #", "Time", "Customer", "Items", "Payment", "Total", ""].map((h) => (
                    <th key={h} className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {bills.map((b) => (
                    <tr key={b.id} className="border-b border-amber-900/5 hover:bg-[#8B5A2B]/5"
                      data-testid={`bill-row-${b.id}`}>
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-[#2C241B]">{b.bill_number}</td>
                      <td className="px-5 py-3 text-[#8A7D71]">{fmt(b.created_at)}</td>
                      <td className="px-5 py-3 text-[#2C241B]">{b.customer_name}</td>
                      <td className="px-5 py-3 text-[#8A7D71]">{b.items?.length || 0}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-[#8B5A2B]/10 text-[#8B5A2B] px-2 py-0.5 rounded-full font-medium">
                          {b.payment_mode === "cash+upi" ? "Split" : b.payment_mode?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-bold text-[#8B5A2B]">₹{b.total?.toFixed(2)}</td>
                      <td className="px-5 py-3">
                        <button onClick={() => setShowBill(b)} className="text-[#8A7D71] hover:text-[#5C4F43]" data-testid={`view-bill-${b.id}`}>
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Detail Modal */}
      {showBill && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl slide-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>{showBill.bill_number}</h2>
                <p className="text-xs text-[#8A7D71]">{showBill.customer_name} · {fmt(showBill.created_at)}</p>
              </div>
              <button onClick={() => setShowBill(null)} className="text-[#8A7D71]"><X size={18} /></button>
            </div>

            <div className="space-y-2 mb-4">
              {(showBill.items || []).map((it, i) => (
                <div key={i} className="flex justify-between text-sm bg-[#F6F3EC] rounded-xl p-2">
                  <span className="text-[#2C241B]">{it.name} × {it.quantity}</span>
                  <span className="text-[#8B5A2B] font-semibold">₹{it.subtotal?.toFixed(0)}</span>
                </div>
              ))}
            </div>

            <div className="bg-[#F6F3EC] rounded-xl p-3 space-y-1 text-sm mb-4">
              <div className="flex justify-between"><span>Subtotal</span><span>₹{showBill.subtotal?.toFixed(2)}</span></div>
              {showBill.overall_discount > 0 && <div className="flex justify-between text-[#B84B4B]"><span>Discount</span><span>−₹{showBill.overall_discount?.toFixed(2)}</span></div>}
              <div className="flex justify-between"><span>CGST (2.5%)</span><span>₹{showBill.cgst?.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>SGST (2.5%)</span><span>₹{showBill.sgst?.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-[#8B5A2B] pt-1 border-t border-amber-900/10"><span>Total</span><span>₹{showBill.total?.toFixed(2)}</span></div>
            </div>

            {(showBill.inventory_deductions || []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#5C4F43] mb-1.5">Inventory Deducted</p>
                <div className="flex flex-wrap gap-1">
                  {showBill.inventory_deductions.map((d, i) => (
                    <span key={i} className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full">
                      −{d.quantity_deducted} {d.unit} {d.item_name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
