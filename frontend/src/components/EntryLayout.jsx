import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Users2, ShoppingBag, Wallet, Package, Receipt, ClipboardList, UtensilsCrossed, LogOut, Menu, LayoutDashboard, Landmark, Banknote, FileText, UserCheck, BarChart3 } from "lucide-react";
import { useState } from "react";

const NAV = [
  { to: "/entry/walkins",   label: "Walk-ins",      icon: Users2 },
  { to: "/entry/sales",     label: "Online Sales",  icon: ShoppingBag },
  { to: "/entry/purchases", label: "Purchases",     icon: Wallet },
  { to: "/entry/inventory", label: "Inventory",     icon: Package },
  { to: "/entry/inventory-movement", label: "Inventory Movement", icon: BarChart3 },
  { to: "/entry/billing",   label: "Billing",       icon: Receipt },
  { to: "/entry/bills",     label: "Bills",         icon: FileText },
  { to: "/entry/routines",  label: "Routines",      icon: ClipboardList },
  { to: "/entry/menu",      label: "Menu",          icon: UtensilsCrossed },
  { to: "/entry/banking",   label: "Banking",       icon: Landmark },
  { to: "/entry/misc-payments", label: "Misc Payments", icon: Banknote },
  { to: "/entry/customers", label: "Customers",     icon: UserCheck },
];

export default function EntryLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen" style={{ background: "#FDFBF7", fontFamily: "Figtree, sans-serif" }}>
      <aside className={`fixed inset-y-0 left-0 bg-white border-r border-amber-900/10 flex flex-col z-20 transition-all duration-200 ${collapsed ? "w-16" : "w-60"}`}>
        <div className="p-4 border-b border-amber-900/10 flex items-center justify-between">
          {!collapsed && (
            <div>
              <h1 className="text-base font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>Deja Brew</h1>
              <p className="text-[10px] text-[#8B5A2B] uppercase tracking-widest font-medium mt-0.5">Entry</p>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-[#8A7D71] hover:bg-[#8B5A2B]/10 ml-auto" data-testid="sidebar-toggle">
            <Menu size={17} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? "bg-[#8B5A2B] text-white shadow-sm" : "text-[#5C4F43] hover:bg-[#8B5A2B]/10"
                } ${collapsed ? "justify-center" : ""}`
              }
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}>
              <Icon size={18} className="shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
          {user?.role === "owner" && (
            <NavLink to="/dashboard" title={collapsed ? "Dashboard" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-[#8B5A2B] hover:bg-[#8B5A2B]/10 border border-[#8B5A2B]/20 mt-4 ${collapsed ? "justify-center" : ""}`}
              data-testid="nav-dashboard-link">
              <LayoutDashboard size={18} className="shrink-0" />
              {!collapsed && "Owner Dashboard"}
            </NavLink>
          )}
        </nav>

        <div className="p-3 border-t border-amber-900/10">
          {!collapsed && (
            <div className="mb-2 px-3">
              <p className="text-sm font-medium text-[#2C241B] truncate">{user?.name}</p>
              <p className="text-[10px] text-[#8A7D71] capitalize">{user?.role}</p>
            </div>
          )}
          <button onClick={async () => { await logout(); navigate("/login"); }}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-[#5C4F43] hover:bg-red-50 hover:text-[#B84B4B] transition-colors ${collapsed ? "justify-center" : ""}`}
            data-testid="logout-btn" title={collapsed ? "Sign Out" : undefined}>
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
