import React, { useEffect, useState } from "react";
import api from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import {
  Users, Receipt, Wallet, TrendingUp, AlertTriangle, IndianRupee, ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

function StatCard({ label, value, sub, icon: Icon, color = "#8B5A2B", trend }) {
  return (
    <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)] hover:-translate-y-0.5 transition-transform" data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-[#8A7D71] uppercase tracking-[0.15em] font-medium mb-2">{label}</p>
          <p className="text-2xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>{value}</p>
          {sub && <p className="text-xs text-[#8A7D71] mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-3 text-xs font-medium text-[#3E5C46]">
          <ArrowUpRight size={12} /> <span>{trend}</span>
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-amber-900/10 rounded-xl p-3 shadow-lg text-sm">
        <p className="text-[#8A7D71] text-xs mb-1">{label}</p>
        <p className="text-[#8B5A2B] font-bold">₹{payload[0]?.value?.toFixed(0)}</p>
        {payload[1] && <p className="text-[#5C4F43]">{payload[1]?.value} walk-ins</p>}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard/stats")
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#8A7D71]">Loading...</div>
    );
  }

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
          Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"}, {user?.name}
        </h1>
        <p className="text-[#8A7D71] text-sm mt-1">{today}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Today's Walk-ins"
          value={stats?.walkins?.total ?? 0}
          sub={`${stats?.walkins?.active ?? 0} still inside`}
          icon={Users}
          color="#8B5A2B"
        />
        <StatCard
          label="Today's Revenue"
          value={`₹${(stats?.bills?.revenue ?? 0).toLocaleString("en-IN")}`}
          sub={`${stats?.bills?.total ?? 0} bills`}
          icon={IndianRupee}
          color="#3E5C46"
        />
        <StatCard
          label="Float Balance"
          value={`₹${(stats?.float?.balance ?? 5200).toLocaleString("en-IN")}`}
          sub={`₹${(stats?.float?.spent ?? 0).toFixed(0)} spent`}
          icon={Wallet}
          color={stats?.float?.balance < 2000 ? "#B84B4B" : "#D48B3D"}
        />
        <StatCard
          label="Billing Ratio"
          value={`${stats?.billing_headcount_ratio ?? 0}%`}
          sub="Bills per walk-in"
          icon={TrendingUp}
          color="#C06C4C"
        />
      </div>

      {/* Row: chart + side info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* 7-day Revenue Trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
          <h2 className="text-base font-semibold text-[#2C241B] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
            7-Day Revenue Trend
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.trend || []} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#8A7D71" }}
                tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                axisLine={false} tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: "#8A7D71" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" fill="#8B5A2B" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Side info */}
        <div className="space-y-4">
          {/* Payment split */}
          <div className="bg-white rounded-2xl border border-amber-900/10 p-5 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
            <h3 className="text-sm font-semibold text-[#2C241B] mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>
              Today's Payments
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#5C4F43]">Cash</span>
                <span className="font-semibold text-[#2C241B]">₹{(stats?.bills?.cash ?? 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#5C4F43]">UPI</span>
                <span className="font-semibold text-[#2C241B]">₹{(stats?.bills?.upi ?? 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-amber-900/10 pt-2 mt-2">
                <span className="font-medium text-[#2C241B]">Total</span>
                <span className="font-bold text-[#8B5A2B]">₹{(stats?.bills?.revenue ?? 0).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* Low stock alert */}
          {(stats?.low_stock_count ?? 0) > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3" data-testid="low-stock-alert">
              <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">{stats.low_stock_count} Low Stock Item{stats.low_stock_count > 1 ? "s" : ""}</p>
                <p className="text-xs text-red-500 mt-0.5">Check inventory page</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Bills */}
      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        <div className="px-5 py-4 border-b border-amber-900/10">
          <h2 className="text-base font-semibold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Recent Bills</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-amber-900/10">
                <th className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">Bill #</th>
                <th className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">Customer</th>
                <th className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">Items</th>
                <th className="text-left text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">Payment</th>
                <th className="text-right text-xs text-[#8A7D71] uppercase tracking-wider px-5 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recent_bills ?? []).length === 0 ? (
                <tr><td colSpan={5} className="text-center text-[#8A7D71] py-8 text-sm">No bills today yet</td></tr>
              ) : (
                stats.recent_bills.map((b) => (
                  <tr key={b.id} className="border-b border-amber-900/5 hover:bg-[#8B5A2B]/5 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-[#8B5A2B] font-semibold">{b.bill_number}</td>
                    <td className="px-5 py-3 text-[#2C241B]">{b.customer_name}</td>
                    <td className="px-5 py-3 text-[#5C4F43]">{b.items?.length} item{b.items?.length !== 1 ? "s" : ""}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        b.payment_mode === "cash" ? "bg-green-100 text-green-700"
                          : b.payment_mode === "upi" ? "bg-blue-100 text-blue-700"
                          : "bg-orange-100 text-orange-700"
                      }`}>
                        {b.payment_mode?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-[#8B5A2B]">₹{b.total?.toLocaleString("en-IN")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
