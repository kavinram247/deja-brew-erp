import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { toast } from "sonner";
import { Plus, Trash2, Wallet, ChevronLeft, ChevronRight } from "lucide-react";

const CATEGORIES = ["Raw Materials", "Consumables", "Utilities", "Staff", "Maintenance", "Other"];

function fmt(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}
function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function FloatPage() {
  const [floatData, setFloatData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("Raw Materials");
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  const today = new Date().toISOString().split("T")[0];

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/float?date_str=${date}`);
      setFloatData(data);
    } catch { toast.error("Failed to load float data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [date]);

  const changeDate = (days) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split("T")[0]);
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!desc.trim()) { toast.error("Enter description"); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error("Enter valid amount"); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/float/expenses", { description: desc, amount: parseFloat(amount), category: cat });
      setFloatData(data); setDesc(""); setAmount(""); setCat("Raw Materials"); setShowForm(false);
      toast.success("Expense added");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to add expense"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (expId) => {
    if (!window.confirm("Remove this expense?")) return;
    try {
      const { data } = await api.delete(`/float/expenses/${expId}`);
      setFloatData(data); toast.success("Expense removed");
    } catch { toast.error("Failed to remove expense"); }
  };

  const spent = floatData ? floatData.opening_balance - floatData.closing_balance : 0;
  const spentPct = floatData ? (spent / floatData.opening_balance) * 100 : 0;
  const isToday = date === today;

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Float</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Daily cash float management</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10">
            <ChevronLeft size={16} />
          </button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-amber-900/20 px-3 py-2 text-sm text-[#2C241B] focus:outline-none focus:border-[#8B5A2B]"
            data-testid="float-date-picker" />
          <button onClick={() => changeDate(1)} disabled={date >= today}
            className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10 disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-[#8A7D71] py-20">Loading...</div>
      ) : (
        <>
          <p className="text-sm text-[#8A7D71] mb-4">{fmtDate(date)} {!isToday && "(Past record)"}</p>

          {/* Float summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="float-opening">
              <p className="text-xs text-[#8A7D71] uppercase tracking-wider mb-2">Opening Float</p>
              <p className="text-2xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
                ₹{floatData?.opening_balance?.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid="float-spent">
              <p className="text-xs text-[#8A7D71] uppercase tracking-wider mb-2">Total Spent</p>
              <p className="text-2xl font-bold text-[#B84B4B]" style={{ fontFamily: "Outfit, sans-serif" }}>
                ₹{spent.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-[#8A7D71] mt-1">{spentPct.toFixed(1)}% of float</p>
            </div>
            <div className={`rounded-2xl border p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)] ${
              floatData?.closing_balance < 1000 ? "bg-red-50 border-red-200" : "bg-white border-amber-900/10"
            }`} data-testid="float-remaining">
              <p className="text-xs text-[#8A7D71] uppercase tracking-wider mb-2">Remaining</p>
              <p className={`text-2xl font-bold ${floatData?.closing_balance < 1000 ? "text-red-600" : "text-[#3E5C46]"}`}
                style={{ fontFamily: "Outfit, sans-serif" }}>
                ₹{floatData?.closing_balance?.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-white rounded-2xl border border-amber-900/10 p-5 mb-6 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
            <div className="flex justify-between text-xs text-[#8A7D71] mb-2">
              <span>Float Utilisation</span><span>{spentPct.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-[#F6F3EC] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(spentPct, 100)}%`, background: spentPct > 80 ? "#B84B4B" : spentPct > 50 ? "#D48B3D" : "#3E5C46" }} />
            </div>
          </div>

          {/* Expenses section */}
          <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-amber-900/10">
              <h2 className="text-base font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
                Expenses ({floatData?.expenses?.length || 0})
              </h2>
              {isToday && (
                <button onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 bg-[#8B5A2B] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]"
                  data-testid="add-expense-btn">
                  <Plus size={14} /> Add Expense
                </button>
              )}
            </div>

            {/* Add expense form */}
            {showForm && (
              <div className="p-5 border-b border-amber-900/10 bg-[#F6F3EC]">
                <form onSubmit={handleAddExpense} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Description *</label>
                      <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Bought salt 1kg"
                        className="w-full rounded-xl border border-amber-900/20 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                        data-testid="expense-desc-input" required />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Amount (₹) *</label>
                      <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-amber-900/20 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                        data-testid="expense-amount-input" required />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Category</label>
                      <select value={cat} onChange={(e) => setCat(e.target.value)}
                        className="w-full rounded-xl border border-amber-900/20 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                        data-testid="expense-category-select">
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowForm(false); setDesc(""); setAmount(""); }}
                      className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
                    <button type="submit" disabled={saving}
                      className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold disabled:opacity-50"
                      data-testid="save-expense-btn">
                      {saving ? "Saving..." : "Add Expense"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Expense list */}
            {floatData?.expenses?.length === 0 ? (
              <div className="text-center py-10">
                <Wallet size={36} className="text-[#C9B99A] mx-auto mb-2" />
                <p className="text-[#8A7D71] text-sm">No expenses {isToday ? "today" : "this day"}</p>
              </div>
            ) : (
              <div className="divide-y divide-amber-900/5">
                {floatData.expenses.map((exp, i) => (
                  <div key={exp.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#8B5A2B]/5 transition-colors"
                    data-testid={`expense-row-${i}`}>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#2C241B]">{exp.description}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{exp.category}</span>
                        <span className="text-xs text-[#8A7D71]">{fmt(exp.timestamp)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#B84B4B]">−₹{exp.amount.toLocaleString("en-IN")}</span>
                      {isToday && (
                        <button onClick={() => handleDelete(exp.id)}
                          className="text-[#8A7D71] hover:text-[#B84B4B] transition-colors"
                          data-testid={`delete-expense-${i}`}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {/* Total row */}
                <div className="flex items-center justify-between px-5 py-3 bg-[#F6F3EC]">
                  <span className="text-sm font-bold text-[#2C241B]">Total Spent</span>
                  <span className="font-bold text-[#B84B4B]">−₹{spent.toLocaleString("en-IN")}</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
