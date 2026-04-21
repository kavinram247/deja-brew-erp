import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, UtensilsCrossed, ChefHat, X } from "lucide-react";

const CATS = ["Coffee", "Tea", "Beverages", "Breakfast", "Snacks", "Mains", "Desserts", "Other"];

const EMPTY_ITEM = { name: "", category: "Coffee", price: 0, description: "", active: true };

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [recipes, setRecipes] = useState({}); // menu_item_id -> recipe
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showItemForm, setShowItemForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);

  const [recipeTarget, setRecipeTarget] = useState(null);
  const [recipeIngredients, setRecipeIngredients] = useState([]);

  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("All");

  const load = async () => {
    setLoading(true);
    try {
      const [m, r, inv] = await Promise.all([api.get("/menu"), api.get("/recipes"), api.get("/inventory")]);
      setItems(m.data); setInventory(inv.data);
      const map = {};
      r.data.forEach((x) => { map[x.menu_item_id] = x; });
      setRecipes(map);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const cats = ["All", ...new Set(items.map((i) => i.category))];
  const filtered = filter === "All" ? items : items.filter((i) => i.category === filter);

  const openAdd = () => { setItemForm(EMPTY_ITEM); setEditItem(null); setShowItemForm(true); };
  const openEdit = (item) => {
    setItemForm({
      name: item.name, category: item.category, price: item.price,
      description: item.description || "", active: item.active,
    });
    setEditItem(item); setShowItemForm(true);
  };

  const saveItem = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...itemForm, price: parseFloat(itemForm.price) || 0 };
      if (editItem) {
        const { data } = await api.put(`/menu/${editItem.id}`, payload);
        setItems((p) => p.map((i) => i.id === editItem.id ? data : i));
        toast.success("Updated");
      } else {
        const { data } = await api.post("/menu", payload);
        setItems((p) => [...p, data]);
        toast.success("Item added");
      }
      setShowItemForm(false);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      await api.delete(`/menu/${id}`);
      setItems((p) => p.filter((i) => i.id !== id));
      toast.success("Deleted");
    } catch { toast.error("Failed"); }
  };

  const openRecipe = (item) => {
    const existing = recipes[item.id];
    setRecipeIngredients(existing ? [...existing.ingredients] : []);
    setRecipeTarget(item);
  };

  const addIng = () => {
    if (inventory.length === 0) { toast.error("Add inventory items first"); return; }
    const first = inventory[0];
    setRecipeIngredients((p) => [...p, { inventory_item_id: first.id, item_name: first.name, quantity: 0, unit: first.unit }]);
  };

  const updateIng = (idx, field, val) => {
    setRecipeIngredients((p) => {
      const list = [...p];
      if (field === "inventory_item_id") {
        const inv = inventory.find((i) => i.id === val);
        list[idx] = { ...list[idx], inventory_item_id: val, item_name: inv?.name || "", unit: inv?.unit || "" };
      } else {
        list[idx] = { ...list[idx], [field]: val };
      }
      return list;
    });
  };

  const removeIng = (idx) => {
    setRecipeIngredients((p) => p.filter((_, i) => i !== idx));
  };

  const saveRecipe = async () => {
    setSaving(true);
    try {
      const payload = {
        menu_item_id: recipeTarget.id,
        menu_item_name: recipeTarget.name,
        ingredients: recipeIngredients.map((i) => ({
          inventory_item_id: i.inventory_item_id,
          item_name: i.item_name,
          quantity: parseFloat(i.quantity) || 0,
          unit: i.unit || "",
        })),
      };
      const { data } = await api.post("/recipes", payload);
      setRecipes((p) => ({ ...p, [recipeTarget.id]: data }));
      setRecipeTarget(null);
      toast.success("Recipe saved — inventory will deduct on bills");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const deleteRecipe = async () => {
    if (!window.confirm("Remove recipe mapping? Inventory won't deduct.")) return;
    try {
      await api.delete(`/recipes/${recipeTarget.id}`);
      setRecipes((p) => { const n = { ...p }; delete n[recipeTarget.id]; return n; });
      setRecipeTarget(null);
      toast.success("Recipe removed");
    } catch { toast.error("Failed"); }
  };

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Menu & Recipes</h1>
          <p className="text-[#8A7D71] text-sm mt-1">{items.length} items · {Object.keys(recipes).length} recipes mapped</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {cats.map((c) => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === c ? "bg-[#8B5A2B] text-white" : "bg-white border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"
              }`}
              data-testid={`menu-filter-${c.toLowerCase()}`}>{c}</button>
          ))}
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-[#8B5A2B] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822] ml-2"
            data-testid="add-menu-btn">
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      {loading ? <div className="text-center text-[#8A7D71] py-16">Loading...</div>
        : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-amber-900/10 p-12 text-center">
            <UtensilsCrossed size={44} className="text-[#C9B99A] mx-auto mb-2" />
            <p className="text-[#8A7D71] text-sm">No menu items yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => {
              const hasRecipe = !!recipes[item.id];
              const ingCount = recipes[item.id]?.ingredients?.length || 0;
              return (
                <div key={item.id}
                  className={`bg-white rounded-2xl border p-4 shadow-[0_4px_24px_rgba(44,36,27,0.04)] ${!item.active ? "opacity-50" : "border-amber-900/10"}`}
                  data-testid={`menu-card-${item.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#2C241B] truncate">{item.name}</p>
                      <p className="text-[10px] text-[#8A7D71] uppercase tracking-wider mt-0.5">{item.category}</p>
                    </div>
                    <span className="text-lg font-bold text-[#8B5A2B]" style={{ fontFamily: "Outfit, sans-serif" }}>
                      ₹{item.price}
                    </span>
                  </div>
                  {item.description && <p className="text-xs text-[#8A7D71] mb-2">{item.description}</p>}

                  <div className={`flex items-center gap-1.5 text-xs rounded-lg p-2 mb-3 ${
                    hasRecipe ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                  }`}>
                    <ChefHat size={12} />
                    {hasRecipe ? `${ingCount} ingredient${ingCount !== 1 ? "s" : ""} mapped` : "No recipe — won't deduct inventory"}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => openRecipe(item)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-[#8B5A2B]/10 text-[#8B5A2B] text-xs font-semibold hover:bg-[#8B5A2B]/20 transition-colors"
                      data-testid={`recipe-btn-${item.id}`}>
                      {hasRecipe ? "Edit Recipe" : "Add Recipe"}
                    </button>
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-[#8A7D71] hover:text-[#5C4F43]" data-testid={`edit-menu-${item.id}`}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg text-[#8A7D71] hover:text-[#B84B4B]" data-testid={`del-menu-${item.id}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Item Add/Edit Modal */}
      {showItemForm && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
                {editItem ? "Edit Item" : "Add Menu Item"}
              </h2>
              <button onClick={() => setShowItemForm(false)} className="text-[#8A7D71]"><X size={18} /></button>
            </div>
            <form onSubmit={saveItem} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Name *</label>
                <input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="menu-name-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Category</label>
                  <select value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#8B5A2B]">
                    {CATS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Price (₹) *</label>
                  <input type="number" step="0.01" value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} required
                    className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                    data-testid="menu-price-input" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Description</label>
                <input value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  placeholder="Optional"
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]" />
              </div>
              <label className="flex items-center gap-2 text-sm text-[#5C4F43]">
                <input type="checkbox" checked={itemForm.active} onChange={(e) => setItemForm({ ...itemForm, active: e.target.checked })}
                  className="rounded" data-testid="menu-active-toggle" />
                Active (visible in billing)
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowItemForm(false)}
                  className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold disabled:opacity-50"
                  data-testid="save-menu-btn">
                  {saving ? "Saving..." : editItem ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipe Modal */}
      {recipeTarget && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl slide-up">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
                Recipe · {recipeTarget.name}
              </h2>
              <button onClick={() => setRecipeTarget(null)} className="text-[#8A7D71]"><X size={18} /></button>
            </div>
            <p className="text-xs text-[#8A7D71] mb-4">Map ingredients that will auto-deduct from inventory on each sale.</p>

            <div className="space-y-2 mb-4">
              {recipeIngredients.length === 0 ? (
                <p className="text-xs text-[#8A7D71] italic text-center py-4 bg-[#F6F3EC] rounded-xl">No ingredients — click "Add ingredient"</p>
              ) : recipeIngredients.map((ing, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-[#F6F3EC] rounded-xl p-2">
                  <select value={ing.inventory_item_id} onChange={(e) => updateIng(idx, "inventory_item_id", e.target.value)}
                    className="flex-1 rounded-lg border border-amber-900/20 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#8B5A2B]"
                    data-testid={`recipe-ing-select-${idx}`}>
                    {inventory.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.section})</option>)}
                  </select>
                  <input type="number" step="0.001" value={ing.quantity}
                    onChange={(e) => updateIng(idx, "quantity", e.target.value)}
                    placeholder="Qty per dish"
                    className="w-24 rounded-lg border border-amber-900/20 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#8B5A2B]"
                    data-testid={`recipe-ing-qty-${idx}`} />
                  <span className="text-xs text-[#8A7D71] w-10">{ing.unit}</span>
                  <button onClick={() => removeIng(idx)} className="text-[#B84B4B] hover:opacity-80"><X size={14} /></button>
                </div>
              ))}
            </div>

            <button onClick={addIng} className="w-full mb-4 py-2 rounded-xl bg-[#8B5A2B]/10 text-[#8B5A2B] text-sm font-semibold hover:bg-[#8B5A2B]/20"
              data-testid="recipe-add-ing">+ Add Ingredient</button>

            <div className="flex gap-2">
              {recipes[recipeTarget.id] && (
                <button onClick={deleteRecipe}
                  className="px-4 py-2 rounded-xl border border-red-200 text-sm text-[#B84B4B] hover:bg-red-50"
                  data-testid="delete-recipe-btn">Remove Recipe</button>
              )}
              <button onClick={() => setRecipeTarget(null)}
                className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
              <button onClick={saveRecipe} disabled={saving}
                className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold disabled:opacity-50"
                data-testid="save-recipe-btn">
                {saving ? "Saving..." : "Save Recipe"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
