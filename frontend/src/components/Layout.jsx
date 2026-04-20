import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard, Users, Receipt, Package, Wallet,
  Coffee, BarChart2, Settings, LogOut, Menu,
} from "lucide-react";
import { useState } from "react";
import "@/App.css";

const OWNER_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/walkins",   label: "Walk-ins",  icon: Users },
  { to: "/billing",   label: "Billing",   icon: Receipt },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/float",     label: "Float",     icon: Wallet },
  { to: "/menu",      label: "Menu",      icon: Coffee },
  { to: "/reports",   label: "Reports",   icon: BarChart2 },
  { to: "/settings",  label: "Settings",  icon: Settings },
];

const EMPLOYEE_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/walkins",   label: "Walk-ins",  icon: Users },
  { to: "/billing",   label: "Billing",   icon: Receipt },
  { to: "/float",     label: "Float",     icon: Wallet },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const nav = user?.role === "owner" ? OWNER_NAV : EMPLOYEE_NAV;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen" style={{ background: "#FDFBF7", fontFamily: "Figtree, sans-serif" }}>
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 bg-white border-r border-amber-900/10 flex flex-col z-20 transition-all duration-200 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-amber-900/10 flex items-center justify-between">
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
                Deja Brew
              </h1>
              <p className="text-[10px] text-[#8A7D71] uppercase tracking-widest mt-0.5">ERP System</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-[#8A7D71] hover:bg-[#8B5A2B]/10 hover:text-[#8B5A2B] transition-colors ml-auto"
            data-testid="sidebar-toggle-btn"
          >
            <Menu size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#8B5A2B] text-white shadow-sm"
                    : "text-[#5C4F43] hover:bg-[#8B5A2B]/10 hover:text-[#2C241B]"
                } ${collapsed ? "justify-center" : ""}`
              }
              data-testid={`nav-${label.toLowerCase().replace(" ", "-")}`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="p-3 border-t border-amber-900/10">
          {!collapsed && (
            <div className="mb-2 px-3">
              <p className="text-sm font-medium text-[#2C241B] truncate">{user?.name}</p>
              <p className="text-[10px] text-[#8A7D71] capitalize">{user?.role}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-[#5C4F43] hover:bg-red-50 hover:text-[#B84B4B] transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
            data-testid="logout-btn"
            title={collapsed ? "Sign Out" : undefined}
          >
            <LogOut size={16} />
            {!collapsed && "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${collapsed ? "ml-16" : "ml-60"}`}>
        <main className="flex-1 p-6 fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
