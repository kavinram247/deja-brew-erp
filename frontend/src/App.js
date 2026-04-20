import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import WalkIns from "./pages/WalkIns";
import Billing from "./pages/Billing";
import Inventory from "./pages/Inventory";
import FloatPage from "./pages/FloatPage";
import MenuPage from "./pages/MenuPage";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors closeButton />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"  element={<Dashboard />} />
            <Route path="walkins"    element={<WalkIns />} />
            <Route path="billing"    element={<Billing />} />
            <Route path="inventory"  element={<Inventory />} />
            <Route path="float"      element={<FloatPage />} />
            <Route path="menu"       element={<MenuPage />} />
            <Route path="reports"    element={<Reports />} />
            <Route path="settings"   element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
