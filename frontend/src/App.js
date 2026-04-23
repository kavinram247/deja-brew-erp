import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import EntryLayout from "./components/EntryLayout";
import DashboardLayout from "./components/DashboardLayout";
import Login from "./pages/Login";

// Entry pages
import EntryWalkIns   from "./pages/entry/WalkIns";
import OnlineSales    from "./pages/entry/OnlineSales";
import Purchases      from "./pages/entry/Purchases";
import EntryInventory from "./pages/entry/Inventory";
import EntryBilling   from "./pages/entry/Billing";
import EntryBills     from "./pages/entry/Bills";
import Routines       from "./pages/entry/Routines";
import EntryMenu      from "./pages/entry/MenuPage";
import EntryBanking   from "./pages/entry/Banking";
import MiscPayments   from "./pages/entry/MiscPayments";

// Dashboard pages
import Overview     from "./pages/dashboard/Overview";
import DWalkins     from "./pages/dashboard/DWalkins";
import DSales       from "./pages/dashboard/DSales";
import DPurchases   from "./pages/dashboard/DPurchases";
import DInventory   from "./pages/dashboard/DInventory";
import DBilling     from "./pages/dashboard/DBilling";
import Banking      from "./pages/dashboard/Banking";
import DMiscPayments from "./pages/dashboard/DMiscPayments";
import Settings     from "./pages/dashboard/Settings";
import { Coffee } from "lucide-react";

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#FDFBF7" }}>
      <Coffee size={32} className="text-[#8B5A2B] animate-pulse" />
    </div>
  );
}

function RoleRedirect() {
  const { user } = useAuth();
  if (user === undefined) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "owner" ? "/dashboard" : "/entry"} replace />;
}

function OwnerRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "owner") return <Navigate to="/entry" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors closeButton />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Entry — all authenticated users */}
          <Route path="/entry" element={<ProtectedRoute><EntryLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/entry/walkins" replace />} />
            <Route path="walkins"   element={<EntryWalkIns />} />
            <Route path="sales"     element={<OnlineSales />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="inventory" element={<EntryInventory />} />
            <Route path="billing"   element={<EntryBilling />} />
            <Route path="bills"      element={<EntryBills />} />
            <Route path="routines"  element={<Routines />} />
            <Route path="menu"      element={<EntryMenu />} />
            <Route path="banking"   element={<EntryBanking />} />
            <Route path="misc-payments" element={<MiscPayments />} />
          </Route>

          {/* Dashboard — owner only */}
          <Route path="/dashboard" element={<OwnerRoute><DashboardLayout /></OwnerRoute>}>
            <Route index element={<Navigate to="/dashboard/overview" replace />} />
            <Route path="overview"  element={<Overview />} />
            <Route path="walkins"   element={<DWalkins />} />
            <Route path="sales"     element={<DSales />} />
            <Route path="purchases" element={<DPurchases />} />
            <Route path="inventory" element={<DInventory />} />
            <Route path="billing"   element={<DBilling />} />
            <Route path="banking"   element={<Banking />} />
            <Route path="misc-payments" element={<DMiscPayments />} />
            <Route path="settings"  element={<Settings />} />
          </Route>

          <Route path="/" element={<RoleRedirect />} />
          <Route path="*" element={<RoleRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
