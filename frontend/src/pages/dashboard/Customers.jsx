import React, { useState, useEffect, useMemo } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { Users2, Phone, Repeat, Star, Download, FileText, Search, X } from "lucide-react";
import { downloadCsv } from "../../utils/csv";
import { downloadPdf } from "../../utils/pdf";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "repeat", label: "Repeat" },
  { key: "new", label: "New (1 visit)" },
  { key: "phone", label: "With Phone" },
];

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("last_visit");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const { data } = await api.get("/customers"); setCustomers(data); }
      catch { toast.error("Failed to load customers"); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = customers
      .filter((c) => filter === "all"
        || (filter === "repeat" && c.is_repeat)
        || (filter === "new" && c.visit_count === 1)
        || (filter === "phone" && c.phone))
      .filter((c) => !q
        || (c.name || "").toLowerCase().includes(q)
        || (c.phone || "").toLowerCase().includes(q));
    if (sortBy === "last_visit") list.sort((a, b) => (b.last_visit || "").localeCompare(a.last_visit || ""));
    else if (sortBy === "visits") list.sort((a, b) => b.visit_count - a.visit_count);
    else if (sortBy === "spent") list.sort((a, b) => b.total_spent - a.total_spent);
    else if (sortBy === "name") list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return list;
  }, [customers, search, filter, sortBy]);

  const stats = useMemo(() => {
    const total = customers.length;
    const repeat = customers.filter((c) => c.is_repeat).length;
    const withPhone = customers.filter((c) => c.phone).length;
    const totalSpent = customers.reduce((s, c) => s + (c.total_spent || 0), 0);
    const totalVisits = customers.reduce((s, c) => s + c.visit_count, 0);
    return { total, repeat, withPhone, totalSpent, totalVisits };
  }, [customers]);

  const cols = [
    { key: "name", label: "Name" },
    { key: "phone", label: "Mobile" },
    { key: "first_visit", label: "First Visit" },
    { key: "last_visit", label: "Last Visit" },
    { key: "visit_count", label: "Visits" },
    { key: "is_repeat", label: "Repeat", format: (v) => v ? "Yes" : "No" },
    { key: "total_spent", label: "Total Spent (₹)", format: (v) => (v || 0).toFixed(2) },
  ];

  const exportCsv = () => {
    if (filtered.length === 0) { toast.error("Nothing to export"); return; }
    downloadCsv(`dejabrew-customers-${new Date().toISOString().slice(0, 10)}.csv`, filtered, cols);
    toast.success(`Exported ${filtered.length} customers`);
  };
  const exportPdf = () => {
    if (filtered.length === 0) { toast.error("Nothing to export"); return; }
    downloadPdf(filtered, cols, {
      filename: `dejabrew-customers-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "Customer Directory",
      subtitle: `${filtered.length} customers · ${filter !== "all" ? FILTERS.find((f) => f.key === filter)?.label : "All"}${search ? ` · "${search}"` : ""}`,
      summaryLines: [
        { label: "Total Customers", value: stats.total },
        { label: "Repeat Customers", value: `${stats.repeat} (${stats.total > 0 ? ((stats.repeat / stats.total) * 100).toFixed(1) : 0}%)` },
        { label: "With Mobile", value: stats.withPhone },
        { label: "Lifetime Revenue", value: `₹${stats.totalSpent.toLocaleString("en-IN")}` },
      ],
    });
    toast.success("PDF ready");
  };

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Customer Details</h1>
          <p className="text-[#8A7D71] text-sm mt-1">Marketing-ready directory · auto-aggregated from bills</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv}
            className="flex items-center gap-2 bg-[#3E5C46] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#2F4735]"
            data-testid="export-customers-csv">
            <Download size={14} /> CSV
          </button>
          <button onClick={exportPdf}
            className="flex items-center gap-2 bg-[#8B5A2B] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]"
            data-testid="export-customers-pdf">
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard icon={Users2} label="Total" value={stats.total} color="#8B5A2B" testid="cust-total" />
        <StatCard icon={Repeat} label="Repeat" value={stats.repeat}
          sub={`${stats.total > 0 ? ((stats.repeat / stats.total) * 100).toFixed(0) : 0}%`} color="#3E5C46" testid="cust-repeat" />
        <StatCard icon={Phone} label="With Phone" value={stats.withPhone} color="#D48B3D" testid="cust-phone" />
        <StatCard icon={Star} label="Total Visits" value={stats.totalVisits} color="#C06C4C" testid="cust-visits" />
        <StatCard icon={Users2} label="Lifetime ₹" value={`₹${stats.totalSpent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} color="#5C4F43" testid="cust-spent" />
      </div>

      {/* Search + Filter + Sort row */}
      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)] mb-4">
        <div className="px-5 py-3 flex flex-wrap items-center gap-3 border-b border-amber-900/10">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A7D71]" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or mobile..."
              className="w-full pl-9 pr-8 py-2 rounded-full bg-[#F6F3EC] border border-amber-900/15 text-sm focus:outline-none focus:border-[#8B5A2B] focus:ring-2 focus:ring-[#8B5A2B]/15"
              data-testid="cust-search" />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8A7D71] hover:text-[#5C4F43]"
                data-testid="cust-search-clear"><X size={14} /></button>
            )}
          </div>
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f.key ? "bg-[#8B5A2B] text-white" : "bg-[#F6F3EC] text-[#5C4F43] hover:bg-[#8B5A2B]/10"}`}
                data-testid={`cust-filter-${f.key}`}>{f.label}</button>
            ))}
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            className="rounded-full bg-[#F6F3EC] border border-amber-900/15 px-3 py-1.5 text-xs focus:outline-none focus:border-[#8B5A2B]"
            data-testid="cust-sort">
            <option value="last_visit">Sort: Recent visit</option>
            <option value="visits">Sort: Most visits</option>
            <option value="spent">Sort: Highest spend</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>

        {/* Table */}
        {loading ? <div className="text-center text-[#8A7D71] py-12">Loading...</div>
          : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Users2 size={40} className="text-[#C9B99A] mx-auto mb-2" />
              <p className="text-[#8A7D71] text-sm">{customers.length === 0 ? "No customer data yet — bills will populate this directory." : "No customers match the current filter."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-amber-900/10 bg-[#F6F3EC]/40">
                  {["Name", "Mobile", "First Visit", "Last Visit", "Visits", "Status", "Spent"].map((h) => (
                    <th key={h} className="text-left text-[10px] text-[#8A7D71] uppercase tracking-widest px-5 py-3 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={`${c.phone || c.name}-${i}`} className="border-b border-amber-900/5 hover:bg-[#8B5A2B]/5"
                      data-testid={`cust-row-${i}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${c.is_repeat ? "bg-[#8B5A2B]" : "bg-[#C9B99A]"}`}>
                            {(c.name || "?").charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-[#2C241B]">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[#5C4F43] font-mono text-xs">{c.phone || <span className="italic text-[#C9B99A]">—</span>}</td>
                      <td className="px-5 py-3 text-[#8A7D71] text-xs">{c.first_visit || "—"}</td>
                      <td className="px-5 py-3 text-[#5C4F43]">{c.last_visit || "—"}</td>
                      <td className="px-5 py-3 font-bold text-[#8B5A2B]">{c.visit_count}</td>
                      <td className="px-5 py-3">
                        {c.is_repeat
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium"><Repeat size={9} /> Repeat</span>
                          : <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">New</span>}
                      </td>
                      <td className="px-5 py-3 text-[#3E5C46] font-semibold">₹{(c.total_spent || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, testid }) {
  return (
    <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]" data-testid={testid}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15`, color }}>
          <Icon size={14} />
        </div>
        <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold mt-1" style={{ color, fontFamily: "Outfit, sans-serif" }}>{value}</p>
      {sub && <p className="text-xs text-[#8A7D71] mt-0.5">{sub}</p>}
    </div>
  );
}
