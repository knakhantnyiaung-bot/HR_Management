import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";

// Only ever rendered inside <ProtectedRoute/>, so `user` is always set here.
export function RoleBasedHome() {
  const { user } = useAuth();
  const isHrRole = user?.role === "HR_ADMIN" || user?.role === "SUPER_ADMIN";
  return <Navigate to={isHrRole ? "/dashboard" : "/me"} replace />;
}
