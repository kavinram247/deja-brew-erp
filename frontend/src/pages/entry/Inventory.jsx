import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, AlertTriangle, Package } from "lucide-react";

const SECTIONS = ["Barista", "Kitchen", "Other"];
const UNITS = ["kg", "g", "liters", "ml", "pieces", "packets", "bottles", "boxes"];
const CATS = ["Beverages", "Dairy", "Dry Goods", "Produce", "Packaging", "Cleaning", "Other"];
const EMPTY = { name: "", category: "Dry Goods", section: "Barista", current_stock: 0, unit: "kg", min_quantity: 0, cost_per_unit: 0 };

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustMode, setAdjustMode] = useState("add"); // add / set
  const [adjustVal, setAdjustVal] = useState("");
  const [section, setSection] = useState("All");

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/inventory"); setItems(data); }
    catch { toast.error("Failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = section === "All" ? items : items.filter((i) => i.section === section);
  const lowCount = items.filter((i) => i.current_stock <= i.min_quantity).length;

  const openAdd = () => { setForm(EMPTY); setEditItem(null); setShowForm(true); };
  const openEdit = (it) => {
    setForm({ name: it.name, category: it.category, section: it.section || "Other", current_stock: it.current_stock ?? it.quantity ?? 0, unit: it.unit, min_quantity: it.min_quantity, cost_per_unit: it.cost_per_unit });
    setEditItem(it); setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editItem) {
        const { data } = await api.put(`/inventory/${editItem.id}`, form);
        setItems((p) => p.map((i) => (i.id === editItem.id ? data : i)));
        toast.success("Updated");
      } else {
        const { data } = await api.post("/inventory", form);
        setItems((p) => [...p, data]);
        toast.success("Added");
      }
      setShowForm(false);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete?")) return;
    try { await api.delete(`/inventory/${id}`); setItems((p) => p.filter((i) => i.id !== id)); toast.success("Deleted"); }
    catch { toast.error("Failed"); }
  };

  const handleAdjust = async () => {
    const val = parseFloat(adjustVal);
    if (isNaN(val)) { toast.error("Enter valid value"); return; }
    try {
      const endpoint = adjustMode === "set" ? "set-stock" : "adjust";
      const payload = { adjustment: adjustMode === "add" ? val : adjustMode === "reduce" ? -val : val };
      const { data } = await api.post(`/inventory/${adjustItem.id}/${endpoint}`, payload);
      setItems((p) => p.map((i) => (i.id === adjustItem.id ? data : i)));
      setAdjustItem(null); setAdjustVal(""); toast.success("Stock updated");
    } catch { toast.error("Failed"); }
  };

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Inventory</h1>
          <p className="text-[#8A7D71] text-sm mt-1">{items.length} items · {lowCount > 0 ? <span className="text-red-500">{lowCount} low stock</span> : "All OK"}</p>
        </div>
        <div className="flex gap-2">
          {["All", ...SECTIONS].map((s) => (
            <button key={s} onClick={() => setSection(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${section === s ? "bg-[#8B5A2B] text-white" : "bg-white border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"}`}
              data-testid={`section-${s.toLowerCase()}`}>{s}</button>
          ))}
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-[#8B5A2B] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822] ml-2"
            data-testid="add-inv-btn">
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        {loading ? <div className="text-center py-12 text-[#8A7D71]">Loading...</div>
          : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Package size={40} className="text-[#C9B99A] mx-auto mb-2" />
              <p className="text-[#8A7D71] text-sm">No items yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-amber-900/10">
                  {["Item", "Section", "Stock", "Min Stock", "Cost/Unit", "Status", ""].map((h) => (
                    <th key={h} className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((item) => {
                    const stock = item.current_stock ?? item.quantity ?? 0;
                    const low = stock <= item.min_quantity;
                    return (
                      <tr key={item.id} className="border-b border-amber-900/5 hover:bg-[#8B5A2B]/5 transition-colors" data-testid={`inv-row-${item.id}`}>
                        <td className="px-5 py-3 font-medium text-[#2C241B]">{item.name}</td>
                        <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${item.section === "Barista" ? "bg-amber-100 text-amber-700" : item.section === "Kitchen" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{item.section || "Other"}</span></td>
                        <td className="px-5 py-3"><span className={`font-semibold ${low ? "text-red-600" : "text-[#3E5C46]"}`}>{stock} {item.unit}</span></td>
                        <td className="px-5 py-3 text-[#8A7D71]">{item.min_quantity} {item.unit}</td>
                        <td className="px-5 py-3 text-[#5C4F43]">₹{item.cost_per_unit}</td>
                        <td className="px-5 py-3">
                          {stock === 0
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium"><AlertTriangle size={9} /> Out</span>
                            : low
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium"><AlertTriangle size={9} /> Low</span>
                            : <span className="inline-flex px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">OK</span>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setAdjustItem(item); setAdjustMode("add"); setAdjustVal(""); }}
                              className="text-xs text-[#8B5A2B] hover:underline font-medium" data-testid={`adjust-${item.id}`}>Adjust</button>
                            <button onClick={() => openEdit(item)} className="text-[#8A7D71] hover:text-[#5C4F43]" data-testid={`edit-inv-${item.id}`}><Edit2 size={13} /></button>
                            <button onClick={() => handleDelete(item.id)} className="text-[#8A7D71] hover:text-[#B84B4B]" data-testid={`del-inv-${item.id}`}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl slide-up">
            <h2 className="text-lg font-bold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>{editItem ? "Edit Item" : "Add Item"}</h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]" data-testid="inv-name-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Section</label>
                  <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#8B5A2B]">
                    {SECTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#8B5A2B]">
                    {CATS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Current Stock</label>
                  <input type="number" step="0.01" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]" data-testid="inv-stock-input" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Unit</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#8B5A2B]">
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Min Stock (Alert)</label>
                  <input type="number" step="0.01" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Cost/Unit (₹)</label>
                  <input type="number" step="0.01" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold disabled:opacity-50" data-testid="inv-save-btn">
                  {saving ? "Saving..." : editItem ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {adjustItem && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl slide-up">
            <h2 className="text-lg font-bold text-[#2C241B] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>Adjust Stock</h2>
            <p className="text-sm text-[#8A7D71] mb-4">{adjustItem.name} · Current: {adjustItem.current_stock ?? adjustItem.quantity ?? 0} {adjustItem.unit}</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {["add", "reduce", "set"].map((m) => (
                <button key={m} onClick={() => setAdjustMode(m)} className={`py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${adjustMode === m ? "bg-[#8B5A2B] text-white" : "bg-[#F6F3EC] text-[#5C4F43]"}`}>{m}</button>
              ))}
            </div>
            <input type="number" step="0.01" value={adjustVal} onChange={(e) => setAdjustVal(e.target.value)}
              placeholder={`Value in ${adjustItem.unit}`}
              className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B] mb-3" data-testid="adjust-val-input" />
            <div className="flex gap-2">
              <button onClick={() => setAdjustItem(null)} className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
              <button onClick={handleAdjust} className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold" data-testid="confirm-adjust">Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
