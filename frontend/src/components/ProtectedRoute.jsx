import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Coffee } from "lucide-react";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FDFBF7" }}>
        <Coffee size={32} className="text-[#8B5A2B] animate-pulse" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
