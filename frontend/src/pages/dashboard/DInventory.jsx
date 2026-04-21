import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { AlertTriangle, Package, Filter } from "lucide-react";

export default function DInventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("All");
  const [onlyLow, setOnlyLow] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const { data } = await api.get("/inventory"); setItems(data); }
      catch { toast.error("Failed to load"); }
      finally { setLoading(false); }
    })();
  }, []);

  let filtered = items;
  if (section !== "All") filtered = filtered.filter((i) => i.section === section);
  if (onlyLow) filtered = filtered.filter((i) => (i.current_stock ?? 0) <= i.min_quantity);

  const totalValue = filtered.reduce((s, i) => s + (i.current_stock || 0) * (i.cost_per_unit || 0), 0);
  const lowCount = items.filter((i) => (i.current_stock ?? 0) <= i.min_quantity).length;
  const outCount = items.filter((i) => (i.current_stock ?? 0) === 0).length;

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Inventory Overview</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Read-only stock status</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["All", "Barista", "Kitchen", "Other"].map((s) => (
            <button key={s} onClick={() => setSection(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                section === s ? "bg-[#8B5A2B] text-white" : "bg-white border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"
              }`}
              data-testid={`dinv-section-${s.toLowerCase()}`}>{s}</button>
          ))}
          <button onClick={() => setOnlyLow(!onlyLow)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              onlyLow ? "bg-red-100 text-red-700 border border-red-200" : "bg-white border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"
            }`}
            data-testid="dinv-low-toggle">
            <Filter size={12} /> Low stock only
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Items", value: items.length, color: "#8B5A2B", testid: "dinv-total" },
          { label: "Stock Value", value: `₹${totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "#3E5C46", testid: "dinv-value" },
          { label: "Low Stock", value: lowCount, color: "#D48B3D", testid: "dinv-low" },
          { label: "Out of Stock", value: outCount, color: "#B84B4B", testid: "dinv-out" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid={s.testid}>
            <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color, fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        {loading ? <div className="text-center text-[#8A7D71] py-10">Loading...</div>
          : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Package size={36} className="text-[#C9B99A] mx-auto mb-2" />
              <p className="text-[#8A7D71] text-sm">No items match filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-amber-900/10">
                  {["Item", "Section", "Stock", "Min", "Value", "Status"].map((h) => (
                    <th key={h} className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((item) => {
                    const stock = item.current_stock ?? 0;
                    const low = stock <= item.min_quantity;
                    const val = stock * (item.cost_per_unit || 0);
                    return (
                      <tr key={item.id} className="border-b border-amber-900/5 hover:bg-[#8B5A2B]/5" data-testid={`dinv-row-${item.id}`}>
                        <td className="px-5 py-3 font-medium text-[#2C241B]">{item.name}</td>
                        <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${item.section === "Barista" ? "bg-amber-100 text-amber-700" : item.section === "Kitchen" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{item.section || "Other"}</span></td>
                        <td className="px-5 py-3"><span className={`font-semibold ${low ? "text-red-600" : "text-[#3E5C46]"}`}>{stock} {item.unit}</span></td>
                        <td className="px-5 py-3 text-[#8A7D71]">{item.min_quantity} {item.unit}</td>
                        <td className="px-5 py-3 text-[#5C4F43]">₹{val.toFixed(0)}</td>
                        <td className="px-5 py-3">
                          {stock === 0
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium"><AlertTriangle size={9} /> Out</span>
                            : low
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium"><AlertTriangle size={9} /> Low</span>
                            : <span className="inline-flex px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">OK</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
