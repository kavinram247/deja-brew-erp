import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, ClipboardList, Play, X, CheckCircle2 } from "lucide-react";

function fmt(iso) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

const EMPTY = { name: "", description: "", ingredients: [] };

export default function Routines() {
  const [routines, setRoutines] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRoutine, setEditRoutine] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [executeTarget, setExecuteTarget] = useState(null);
  const [executeNotes, setExecuteNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, e, inv] = await Promise.all([
        api.get("/routines"),
        api.get("/routines/executions"),
        api.get("/inventory"),
      ]);
      setRoutines(r.data); setExecutions(e.data); setInventory(inv.data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY); setEditRoutine(null); setShowForm(true); };
  const openEdit = (r) => {
    setForm({
      name: r.name,
      description: r.description || "",
      ingredients: r.ingredients || [],
    });
    setEditRoutine(r); setShowForm(true);
  };

  const addIngredient = () => {
    if (inventory.length === 0) { toast.error("Add inventory items first"); return; }
    const first = inventory[0];
    setForm((p) => ({ ...p, ingredients: [...p.ingredients, {
      inventory_item_id: first.id, item_name: first.name, quantity: 0, unit: first.unit,
    }]}));
  };

  const updateIngredient = (idx, field, val) => {
    setForm((p) => {
      const list = [...p.ingredients];
      if (field === "inventory_item_id") {
        const inv = inventory.find((i) => i.id === val);
        list[idx] = { ...list[idx], inventory_item_id: val, item_name: inv?.name || "", unit: inv?.unit || "" };
      } else {
        list[idx] = { ...list[idx], [field]: val };
      }
      return { ...p, ingredients: list };
    });
  };

  const removeIngredient = (idx) => {
    setForm((p) => ({ ...p, ingredients: p.ingredients.filter((_, i) => i !== idx) }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Enter routine name"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        ingredients: form.ingredients.map((i) => ({
          inventory_item_id: i.inventory_item_id,
          item_name: i.item_name,
          quantity: parseFloat(i.quantity) || 0,
          unit: i.unit || "",
        })),
      };
      if (editRoutine) {
        const { data } = await api.put(`/routines/${editRoutine.id}`, payload);
        setRoutines((p) => p.map((r) => r.id === editRoutine.id ? data : r));
        toast.success("Updated");
      } else {
        const { data } = await api.post("/routines", payload);
        setRoutines((p) => [...p, data]);
        toast.success("Routine created");
      }
      setShowForm(false);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this routine?")) return;
    try {
      await api.delete(`/routines/${id}`);
      setRoutines((p) => p.filter((r) => r.id !== id));
      toast.success("Deleted");
    } catch { toast.error("Failed"); }
  };

  const handleExecute = async () => {
    setSaving(true);
    try {
      const { data } = await api.post(`/routines/${executeTarget.id}/execute`, { notes: executeNotes || null });
      setExecutions((p) => [data, ...p]);
      setExecuteTarget(null); setExecuteNotes("");
      toast.success(`${executeTarget.name} executed · inventory deducted`);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to execute"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Routines</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Machine testing · cleaning · daily checks (auto-deducts ingredients)</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-[#8B5A2B] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]"
          data-testid="add-routine-btn">
          <Plus size={16} /> New Routine
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Routines list */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)] mb-6">
            <div className="px-5 py-4 border-b border-amber-900/10">
              <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>All Routines</h2>
            </div>
            {loading ? <div className="text-center text-[#8A7D71] py-10">Loading...</div>
              : routines.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList size={40} className="text-[#C9B99A] mx-auto mb-2" />
                  <p className="text-[#8A7D71] text-sm">No routines yet. Create your first routine.</p>
                </div>
              ) : (
                <div className="divide-y divide-amber-900/5">
                  {routines.map((r) => (
                    <div key={r.id} className="px-5 py-4 hover:bg-[#8B5A2B]/5 transition-colors"
                      data-testid={`routine-row-${r.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-[#2C241B]">{r.name}</p>
                          {r.description && <p className="text-xs text-[#8A7D71] mt-0.5">{r.description}</p>}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {(r.ingredients || []).map((i, k) => (
                              <span key={k} className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                {i.item_name} · {i.quantity} {i.unit}
                              </span>
                            ))}
                            {(!r.ingredients || r.ingredients.length === 0) && (
                              <span className="text-[10px] text-[#8A7D71]">No ingredients mapped</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setExecuteTarget(r); setExecuteNotes(""); }}
                            className="flex items-center gap-1 bg-[#3E5C46] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90"
                            data-testid={`execute-${r.id}`}>
                            <Play size={12} /> Execute
                          </button>
                          <button onClick={() => openEdit(r)} className="text-[#8A7D71] hover:text-[#5C4F43]" data-testid={`edit-routine-${r.id}`}>
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(r.id)} className="text-[#8A7D71] hover:text-[#B84B4B]" data-testid={`del-routine-${r.id}`}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* Execution log */}
        <div>
          <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
            <div className="px-5 py-4 border-b border-amber-900/10">
              <h2 className="font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Today's Log</h2>
              <p className="text-xs text-[#8A7D71]">{executions.length} executions</p>
            </div>
            {executions.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle2 size={32} className="text-[#C9B99A] mx-auto mb-2" />
                <p className="text-xs text-[#8A7D71]">No routines executed yet today</p>
              </div>
            ) : (
              <div className="divide-y divide-amber-900/5 max-h-[500px] overflow-y-auto">
                {executions.map((e) => (
                  <div key={e.id} className="px-5 py-3" data-testid={`execution-${e.id}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#2C241B]">{e.routine_name}</p>
                      <span className="text-xs text-[#8A7D71]">{fmt(e.executed_at)}</span>
                    </div>
                    <p className="text-[10px] text-[#8A7D71] mt-0.5">by {e.executed_by_name}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(e.deductions || []).map((d, i) => (
                        <span key={i} className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full">
                          −{d.quantity_deducted} {d.unit} {d.item_name}
                        </span>
                      ))}
                    </div>
                    {e.notes && <p className="text-xs text-[#8A7D71] mt-1 italic">"{e.notes}"</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
                {editRoutine ? "Edit Routine" : "New Routine"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-[#8A7D71] hover:text-[#2C241B]"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  placeholder="e.g. Morning espresso machine test"
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="routine-name-input" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional details"
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[#5C4F43]">Ingredients Used</label>
                  <button type="button" onClick={addIngredient}
                    className="text-xs text-[#8B5A2B] font-semibold hover:underline"
                    data-testid="add-ingredient-btn">+ Add ingredient</button>
                </div>
                <div className="space-y-2">
                  {form.ingredients.length === 0 ? (
                    <p className="text-xs text-[#8A7D71] italic text-center py-3 bg-[#F6F3EC] rounded-xl">No ingredients — executing this routine will not deduct inventory</p>
                  ) : form.ingredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-[#F6F3EC] rounded-xl p-2">
                      <select value={ing.inventory_item_id}
                        onChange={(e) => updateIngredient(idx, "inventory_item_id", e.target.value)}
                        className="flex-1 rounded-lg border border-amber-900/20 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#8B5A2B]"
                        data-testid={`routine-ing-select-${idx}`}>
                        {inventory.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.section})</option>)}
                      </select>
                      <input type="number" step="0.01" value={ing.quantity}
                        onChange={(e) => updateIngredient(idx, "quantity", e.target.value)}
                        placeholder="Qty"
                        className="w-20 rounded-lg border border-amber-900/20 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#8B5A2B]"
                        data-testid={`routine-ing-qty-${idx}`} />
                      <span className="text-xs text-[#8A7D71] w-10">{ing.unit}</span>
                      <button type="button" onClick={() => removeIngredient(idx)} className="text-[#B84B4B] hover:opacity-80">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold disabled:opacity-50"
                  data-testid="save-routine-btn">
                  {saving ? "Saving..." : editRoutine ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Execute Confirmation Modal */}
      {executeTarget && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl slide-up">
            <h2 className="text-lg font-bold text-[#2C241B] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>
              Execute: {executeTarget.name}
            </h2>
            <p className="text-sm text-[#8A7D71] mb-4">This will deduct the following ingredients from inventory:</p>
            <div className="bg-[#F6F3EC] rounded-xl p-3 mb-4 space-y-1">
              {(executeTarget.ingredients || []).length === 0 ? (
                <p className="text-xs text-[#8A7D71]">No ingredients mapped</p>
              ) : (executeTarget.ingredients || []).map((i, k) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-[#5C4F43]">{i.item_name}</span>
                  <span className="font-semibold text-[#B84B4B]">−{i.quantity} {i.unit}</span>
                </div>
              ))}
            </div>
            <input value={executeNotes} onChange={(e) => setExecuteNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm mb-4 focus:outline-none focus:border-[#8B5A2B]"
              data-testid="execute-notes" />
            <div className="flex gap-2">
              <button onClick={() => setExecuteTarget(null)}
                className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
              <button onClick={handleExecute} disabled={saving}
                className="flex-1 py-2 rounded-xl bg-[#3E5C46] text-white text-sm font-semibold disabled:opacity-50"
                data-testid="confirm-execute-btn">
                {saving ? "Executing..." : "Confirm & Execute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
