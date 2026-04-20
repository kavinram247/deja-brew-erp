import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { Plus, Trash2, Users, ShieldCheck, Shield } from "lucide-react";

const EMPTY = { email: "", password: "", name: "", role: "employee" };

export default function Settings() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!isOwner) { setLoading(false); return; }
    try { const { data } = await api.get("/users"); setUsers(data); }
    catch { toast.error("Failed to load users"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const { data } = await api.post("/auth/register", form);
      setUsers((p) => [...p, data]);
      setForm(EMPTY); setShowForm(false);
      toast.success(`${form.role === "owner" ? "Owner" : "Employee"} account created`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create user");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${id}`);
      setUsers((p) => p.filter((u) => u.id !== id));
      toast.success("User deleted");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to delete"); }
  };

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-64" style={{ fontFamily: "Figtree, sans-serif" }}>
        <Shield size={48} className="text-[#C9B99A] mb-3" />
        <p className="text-[#5C4F43] font-medium">Owner access required</p>
        <p className="text-[#8A7D71] text-sm mt-1">This page is only accessible to owners</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Settings</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Manage team access</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#8B5A2B] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]"
          data-testid="add-user-btn">
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Current user info */}
      <div className="bg-[#8B5A2B]/5 border border-[#8B5A2B]/20 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8B5A2B]/20 flex items-center justify-center">
            <ShieldCheck size={20} className="text-[#8B5A2B]" />
          </div>
          <div>
            <p className="font-semibold text-[#2C241B]">{user?.name}</p>
            <p className="text-xs text-[#8A7D71]">{user?.email} · Owner</p>
          </div>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        <div className="px-5 py-4 border-b border-amber-900/10 flex items-center gap-2">
          <Users size={18} className="text-[#8B5A2B]" />
          <h2 className="text-base font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
            Team Members ({users.length})
          </h2>
        </div>
        {loading ? (
          <div className="text-center text-[#8A7D71] py-10">Loading...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-10 text-[#8A7D71] text-sm">No users yet</div>
        ) : (
          <div className="divide-y divide-amber-900/5">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-4 hover:bg-[#8B5A2B]/5 transition-colors"
                data-testid={`user-row-${u.id}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                    u.role === "owner" ? "bg-[#8B5A2B]/20 text-[#8B5A2B]" : "bg-[#F6F3EC] text-[#5C4F43]"
                  }`}>
                    {u.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-[#2C241B] text-sm">{u.name}</p>
                    <p className="text-xs text-[#8A7D71]">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                    u.role === "owner" ? "bg-[#8B5A2B]/15 text-[#8B5A2B]" : "bg-[#F6F3EC] text-[#5C4F43]"
                  }`}>
                    {u.role === "owner" ? <ShieldCheck size={11} /> : <Shield size={11} />}
                    {u.role === "owner" ? "Owner" : "Employee"}
                  </span>
                  {u.id !== user?.id && (
                    <button onClick={() => handleDelete(u.id, u.name)}
                      className="text-[#8A7D71] hover:text-[#B84B4B] transition-colors"
                      data-testid={`delete-user-${u.id}`}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add user modal */}
      {showForm && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl slide-up">
            <h2 className="text-lg font-bold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Add Team Member</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Full Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  placeholder="Staff name"
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="new-user-name" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
                  placeholder="staff@dejabrew.com"
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="new-user-email" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Password *</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="new-user-password" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B] bg-white"
                  data-testid="new-user-role">
                  <option value="employee">Employee</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY); }}
                  className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold disabled:opacity-50"
                  data-testid="save-user-btn">
                  {saving ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
