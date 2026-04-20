import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { Plus, Edit2, Trash2, Coffee, ToggleLeft, ToggleRight } from "lucide-react";

const CATEGORIES = ["Hot Drinks", "Cold Drinks", "Food", "Snacks", "Desserts", "Other"];
const EMPTY = { name: "", category: "Hot Drinks", price: 0, description: "", active: true };

export default function MenuPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [catFilter, setCatFilter] = useState("All");

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/menu"); setItems(data); }
    catch { toast.error("Failed to load menu"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY); setEditItem(null); setShowForm(true); };
  const openEdit = (item) => {
    setForm({ name: item.name, category: item.category, price: item.price, description: item.description || "", active: item.active });
    setEditItem(item); setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editItem) {
        const { data } = await api.put(`/menu/${editItem.id}`, form);
        setItems((p) => p.map((i) => (i.id === editItem.id ? data : i)));
        toast.success("Menu item updated");
      } else {
        const { data } = await api.post("/menu", form);
        setItems((p) => [...p, data]);
        toast.success("Menu item added");
      }
      setShowForm(false);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to save"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this menu item?")) return;
    try { await api.delete(`/menu/${id}`); setItems((p) => p.filter((i) => i.id !== id)); toast.success("Deleted"); }
    catch { toast.error("Failed to delete"); }
  };

  const toggleActive = async (item) => {
    try {
      const { data } = await api.put(`/menu/${item.id}`, { ...item, active: !item.active });
      setItems((p) => p.map((i) => (i.id === item.id ? data : i)));
      toast.success(data.active ? "Item enabled" : "Item hidden");
    } catch { toast.error("Failed to update"); }
  };

  const cats = ["All", ...CATEGORIES];
  const filtered = catFilter === "All" ? items : items.filter((i) => i.category === catFilter);

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Menu</h1>
          <p className="text-[#8A7D71] text-sm mt-1">{items.filter((i) => i.active).length} active items · {items.length} total</p>
        </div>
        {isOwner && (
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-[#8B5A2B] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]"
            data-testid="add-menu-btn">
            <Plus size={16} /> Add Item
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {cats.map((c) => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              catFilter === c ? "bg-[#8B5A2B] text-white" : "bg-white border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"
            }`}
            data-testid={`menu-cat-${c.toLowerCase().replace(/\s+/g, "-")}`}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-[#8A7D71] py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Coffee size={48} className="text-[#C9B99A] mx-auto mb-3" />
          <p className="text-[#8A7D71]">No menu items yet</p>
          {isOwner && (
            <button onClick={openAdd} className="mt-4 bg-[#8B5A2B] text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]">
              Add First Item
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <div key={item.id}
              className={`bg-white rounded-2xl border p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)] transition-all ${
                item.active ? "border-amber-900/10" : "border-amber-900/10 opacity-60"
              }`}
              data-testid={`menu-card-${item.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <span className="text-[10px] text-[#8A7D71] uppercase tracking-wider">{item.category}</span>
                  <h3 className="font-semibold text-[#2C241B] text-base mt-0.5">{item.name}</h3>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ml-2 ${
                  item.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}>{item.active ? "Active" : "Hidden"}</span>
              </div>
              {item.description && <p className="text-xs text-[#8A7D71] mb-3 line-clamp-2">{item.description}</p>}
              <p className="text-2xl font-bold text-[#8B5A2B]" style={{ fontFamily: "Outfit, sans-serif" }}>₹{item.price}</p>
              {isOwner && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-amber-900/10">
                  <button onClick={() => toggleActive(item)}
                    className="flex items-center gap-1 text-xs text-[#8A7D71] hover:text-[#5C4F43] transition-colors"
                    data-testid={`toggle-active-${item.id}`}>
                    {item.active ? <ToggleRight size={14} className="text-[#3E5C46]" /> : <ToggleLeft size={14} />}
                    {item.active ? "Disable" : "Enable"}
                  </button>
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => openEdit(item)} className="text-[#8A7D71] hover:text-[#5C4F43]" data-testid={`edit-menu-${item.id}`}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="text-[#8A7D71] hover:text-[#B84B4B]" data-testid={`delete-menu-${item.id}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl slide-up">
            <h2 className="text-lg font-bold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
              {editItem ? "Edit Menu Item" : "Add Menu Item"}
            </h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="menu-name-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B] bg-white"
                    data-testid="menu-category-select">
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Price (₹) *</label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                    required className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                    data-testid="menu-price-input" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Description (optional)</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2} placeholder="Short description..."
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B] resize-none" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  id="active-check" className="accent-[#8B5A2B]" />
                <label htmlFor="active-check" className="text-sm text-[#5C4F43]">Active (visible in billing)</label>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold disabled:opacity-50"
                  data-testid="menu-save-btn">
                  {saving ? "Saving..." : editItem ? "Update" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
