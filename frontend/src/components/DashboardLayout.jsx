import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LayoutDashboard, Users, TrendingUp, ShoppingCart, Package, Receipt, Landmark, Settings, LogOut, Menu, ArrowLeft, Banknote, UserCheck, BarChart3 } from "lucide-react";
import { useState } from "react";

const NAV = [
  { to: "/dashboard/overview",   label: "Overview",   icon: LayoutDashboard },
  { to: "/dashboard/walkins",    label: "Walk-ins",   icon: Users },
  { to: "/dashboard/sales",      label: "Sales",      icon: TrendingUp },
  { to: "/dashboard/purchases",  label: "Purchases",  icon: ShoppingCart },
  { to: "/dashboard/inventory",  label: "Inventory",  icon: Package },
  { to: "/dashboard/inventory-movement", label: "Inventory Movement", icon: BarChart3 },
  { to: "/dashboard/billing",    label: "Billing",    icon: Receipt },
  { to: "/dashboard/banking",    label: "Banking",    icon: Landmark },
  { to: "/dashboard/misc-payments", label: "Misc Payments", icon: Banknote },
  { to: "/dashboard/customers",  label: "Customers",  icon: UserCheck },
  { to: "/dashboard/settings",   label: "Settings",   icon: Settings },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen" style={{ background: "#FDFBF7", fontFamily: "Figtree, sans-serif" }}>
      <aside className={`fixed inset-y-0 left-0 bg-[#2C241B] flex flex-col z-20 transition-all duration-200 ${collapsed ? "w-16" : "w-60"}`}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          {!collapsed && (
            <div>
              <h1 className="text-base font-bold text-white" style={{ fontFamily: "Outfit, sans-serif" }}>Deja Brew</h1>
              <p className="text-[10px] text-amber-400 uppercase tracking-widest font-medium mt-0.5">Dashboard</p>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-white/50 hover:bg-white/10 ml-auto" data-testid="dash-sidebar-toggle">
            <Menu size={17} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? "bg-[#8B5A2B] text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                } ${collapsed ? "justify-center" : ""}`
              }
              data-testid={`dash-nav-${label.toLowerCase()}`}>
              <Icon size={18} className="shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
          <NavLink to="/entry" title={collapsed ? "Entry" : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-amber-400/80 hover:bg-white/10 border border-amber-400/20 mt-4 transition-all ${collapsed ? "justify-center" : ""}`}
            data-testid="dash-nav-entry">
            <ArrowLeft size={18} className="shrink-0" />
            {!collapsed && "Entry Mode"}
          </NavLink>
        </nav>

        <div className="p-3 border-t border-white/10">
          {!collapsed && (
            <div className="mb-2 px-3">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-white/50">Owner</p>
            </div>
          )}
          <button onClick={async () => { await logout(); navigate("/login"); }}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-white/60 hover:bg-red-500/20 hover:text-red-400 transition-colors ${collapsed ? "justify-center" : ""}`}
            data-testid="dash-logout-btn" title={collapsed ? "Sign Out" : undefined}>
            <LogOut size={16} />
            {!collapsed && "Sign Out"}
          </button>
        </div>
      </aside>

      <div className={`flex-1 transition-all duration-200 ${collapsed ? "ml-16" : "ml-60"}`}>
        <main className="p-6 fade-in"><Outlet /></main>
      </div>
    </div>
  );
}
