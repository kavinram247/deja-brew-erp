import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Coffee, Eye, EyeOff } from "lucide-react";

const LOGIN_BG =
  "https://images.unsplash.com/photo-1544457070-4cd773b4d71e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjYWZlJTIwaW50ZXJpb3IlMjBhZXN0aGV0aWN8ZW58MHx8fHwxNzc2NzEzMDUyfDA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate("/");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center" style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${LOGIN_BG})` }} />
      <div className="absolute inset-0 bg-[#2C241B]/65" />

      <div className="relative z-10 w-full max-w-md mx-4 slide-up">
        <div className="bg-white rounded-2xl p-8 shadow-2xl border border-amber-900/10">
          {/* Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#8B5A2B]/10 mb-3">
              <Coffee size={28} className="text-[#8B5A2B]" />
            </div>
            <h1 className="text-3xl font-bold text-[#2C241B] tracking-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
              Deja Brew
            </h1>
            <p className="text-[#8A7D71] text-sm mt-1">ERP Management System</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-5 text-sm text-center" data-testid="login-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#2C241B] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-amber-900/20 bg-white px-4 py-2.5 text-[#2C241B] text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5A2B]/20 focus:border-[#8B5A2B] transition-colors"
                placeholder="owner@dejabrew.com"
                required
                data-testid="login-email-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2C241B] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-amber-900/20 bg-white px-4 py-2.5 pr-10 text-[#2C241B] text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5A2B]/20 focus:border-[#8B5A2B] transition-colors"
                  placeholder="••••••••"
                  required
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A7D71] hover:text-[#5C4F43]"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#8B5A2B] text-white rounded-xl px-6 py-3 font-semibold hover:bg-[#704822] active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
              data-testid="login-submit-btn"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
