import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { Plus, Edit2, Trash2, AlertTriangle, Package, RefreshCw } from "lucide-react";

const UNITS = ["kg", "g", "liters", "ml", "pieces", "packets", "bottles", "boxes"];
const CATEGORIES = ["Beverages", "Dairy", "Dry Goods", "Fresh Produce", "Packaging", "Cleaning", "Other"];

const EMPTY = { name: "", category: "Dry Goods", quantity: 0, unit: "kg", min_quantity: 0, cost_per_unit: 0 };

export default function Inventory() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [newQty, setNewQty] = useState("");
  const [catFilter, setCatFilter] = useState("All");

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/inventory"); setItems(data); }
    catch { toast.error("Failed to load inventory"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY); setEditItem(null); setShowForm(true); };
  const openEdit = (item) => {
    setForm({ name: item.name, category: item.category, quantity: item.quantity, unit: item.unit, min_quantity: item.min_quantity, cost_per_unit: item.cost_per_unit });
    setEditItem(item); setShowForm(true);
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
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to save"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    try { await api.delete(`/inventory/${id}`); setItems((p) => p.filter((i) => i.id !== id)); toast.success("Deleted"); }
    catch { toast.error("Failed to delete"); }
  };

  const handleAdjust = async () => {
    if (newQty === "" || isNaN(newQty)) { toast.error("Enter valid quantity"); return; }
    try {
      const { data } = await api.post(`/inventory/${adjustItem.id}/adjust`, { quantity: parseFloat(newQty) });
      setItems((p) => p.map((i) => (i.id === adjustItem.id ? data : i)));
      setAdjustItem(null); setNewQty(""); toast.success("Quantity updated");
    } catch { toast.error("Failed to adjust"); }
  };

  const cats = ["All", ...CATEGORIES];
  const filtered = catFilter === "All" ? items : items.filter((i) => i.category === catFilter);
  const lowStock = items.filter((i) => i.quantity <= i.min_quantity).length;

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Inventory</h1>
          <p className="text-[#8A7D71] text-sm mt-1">{items.length} items · {lowStock > 0 ? <span className="text-red-500">{lowStock} low stock</span> : "All stocked"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10">
            <RefreshCw size={16} />
          </button>
          {isOwner && (
            <button onClick={openAdd}
              className="flex items-center gap-2 bg-[#8B5A2B] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]"
              data-testid="add-inventory-btn">
              <Plus size={16} /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {cats.map((c) => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              catFilter === c ? "bg-[#8B5A2B] text-white" : "bg-white border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"
            }`}
            data-testid={`inv-cat-${c.toLowerCase()}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        {loading ? (
          <div className="text-center text-[#8A7D71] py-12">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Package size={40} className="text-[#C9B99A] mx-auto mb-3" />
            <p className="text-[#8A7D71] text-sm">No inventory items yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-900/10">
                  {["Item", "Category", "Quantity", "Min Stock", "Cost/Unit", "Value", "Status", ""].map((h) => (
                    <th key={h} className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const low = item.quantity <= item.min_quantity;
                  return (
                    <tr key={item.id} className="border-b border-amber-900/5 hover:bg-[#8B5A2B]/5 transition-colors" data-testid={`inv-row-${item.id}`}>
                      <td className="px-5 py-3 font-medium text-[#2C241B]">{item.name}</td>
                      <td className="px-5 py-3 text-[#5C4F43]">{item.category}</td>
                      <td className="px-5 py-3">
                        <span className={`font-semibold ${low ? "text-red-600" : "text-[#3E5C46]"}`}>
                          {item.quantity} {item.unit}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[#8A7D71]">{item.min_quantity} {item.unit}</td>
                      <td className="px-5 py-3 text-[#5C4F43]">₹{item.cost_per_unit}</td>
                      <td className="px-5 py-3 text-[#5C4F43]">₹{(item.quantity * item.cost_per_unit).toFixed(2)}</td>
                      <td className="px-5 py-3">
                        {low ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-medium">
                            <AlertTriangle size={10} /> Low
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">OK</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setAdjustItem(item); setNewQty(item.quantity); }}
                            className="text-xs text-[#8B5A2B] hover:underline font-medium"
                            data-testid={`adjust-qty-${item.id}`}>Adjust</button>
                          {isOwner && (
                            <>
                              <button onClick={() => openEdit(item)} className="text-[#8A7D71] hover:text-[#5C4F43]" data-testid={`edit-inv-${item.id}`}>
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => handleDelete(item.id)} className="text-[#8A7D71] hover:text-[#B84B4B]" data-testid={`delete-inv-${item.id}`}>
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl slide-up">
            <h2 className="text-lg font-bold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
              {editItem ? "Edit Item" : "Add Inventory Item"}
            </h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                    data-testid="inv-name-input" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B] bg-white">
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Unit</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B] bg-white">
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Quantity</label>
                  <input type="number" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                    data-testid="inv-qty-input" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Min Qty (Alert)</label>
                  <input type="number" step="0.01" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Cost per Unit (₹)</label>
                  <input type="number" step="0.01" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43] hover:bg-[#F6F3EC]">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold hover:bg-[#704822] disabled:opacity-50"
                  data-testid="inv-save-btn">
                  {saving ? "Saving..." : editItem ? "Update" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Qty modal */}
      {adjustItem && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl slide-up">
            <h2 className="text-lg font-bold text-[#2C241B] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>Adjust Quantity</h2>
            <p className="text-sm text-[#8A7D71] mb-4">{adjustItem.name}</p>
            <div>
              <label className="text-xs font-medium text-[#5C4F43] mb-1 block">New Quantity ({adjustItem.unit})</label>
              <input type="number" step="0.01" value={newQty} onChange={(e) => setNewQty(e.target.value)}
                className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                data-testid="adjust-qty-input" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setAdjustItem(null)} className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
              <button onClick={handleAdjust} className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold"
                data-testid="confirm-adjust-btn">Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
