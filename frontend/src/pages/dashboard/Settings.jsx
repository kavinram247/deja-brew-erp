import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { UserPlus, Trash2, Users, X, Shield } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export default function Settings() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "employee" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/users"); setUsers(data); }
    catch { toast.error("Failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password || !form.name.trim()) { toast.error("Fill all fields"); return; }
    if (form.password.length < 6) { toast.error("Password must be 6+ chars"); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/auth/register", form);
      setUsers((p) => [...p, { ...data, password_hash: undefined }]);
      setForm({ email: "", password: "", name: "", role: "employee" });
      setShowForm(false);
      toast.success(`User ${data.email} created`);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (u) => {
    if (u.id === user?.id) { toast.error("Cannot delete yourself"); return; }
    if (!window.confirm(`Delete user ${u.email}?`)) return;
    try { await api.delete(`/users/${u.id}`); setUsers((p) => p.filter((x) => x.id !== u.id)); toast.success("Deleted"); }
    catch { toast.error("Failed"); }
  };

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Settings · Users</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Manage employee and owner accounts</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#8B5A2B] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]"
          data-testid="add-user-btn">
          <UserPlus size={16} /> Add User
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        {loading ? <div className="text-center text-[#8A7D71] py-10">Loading...</div>
          : users.length === 0 ? (
            <div className="text-center py-12">
              <Users size={40} className="text-[#C9B99A] mx-auto mb-2" />
              <p className="text-[#8A7D71] text-sm">No users yet</p>
            </div>
          ) : (
            <div className="divide-y divide-amber-900/5">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#8B5A2B]/5"
                  data-testid={`user-row-${u.id}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold ${u.role === "owner" ? "bg-[#2C241B]" : "bg-[#8B5A2B]"}`}>
                      {u.name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="font-medium text-[#2C241B]">{u.name}</p>
                      <p className="text-xs text-[#8A7D71]">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      u.role === "owner" ? "bg-[#2C241B] text-white" : "bg-[#8B5A2B]/10 text-[#8B5A2B]"
                    }`}>
                      {u.role === "owner" && <Shield size={10} />}
                      {u.role}
                    </span>
                    {u.id !== user?.id && (
                      <button onClick={() => handleDelete(u)} className="text-[#8A7D71] hover:text-[#B84B4B]" data-testid={`del-user-${u.id}`}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-[#2C241B]/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Add User</h2>
              <button onClick={() => setShowForm(false)} className="text-[#8A7D71]"><X size={18} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="user-name-input" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="user-email-input" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-1 block">Password * (6+ chars)</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required
                  className="w-full rounded-xl border border-amber-900/20 px-3 py-2 text-sm focus:outline-none focus:border-[#8B5A2B]"
                  data-testid="user-password-input" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4F43] mb-2 block">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {["employee", "owner"].map((r) => (
                    <button key={r} type="button" onClick={() => setForm({ ...form, role: r })}
                      className={`py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
                        form.role === r ? "bg-[#8B5A2B] text-white" : "bg-[#F6F3EC] text-[#5C4F43]"
                      }`}
                      data-testid={`role-${r}`}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl border border-amber-900/20 text-sm text-[#5C4F43]">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-[#8B5A2B] text-white text-sm font-semibold disabled:opacity-50"
                  data-testid="user-save-btn">
                  {saving ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
