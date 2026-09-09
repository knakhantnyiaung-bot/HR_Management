import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";

// Only ever rendered inside <ProtectedRoute/>, so `user` is always set here.
export function RoleBasedHome() {
  const { user } = useAuth();
  const isHrRole = user?.role === "HR_ADMIN" || user?.role === "SUPER_ADMIN";
  // Sprint 2 — a Hiring Manager has no HR dashboard access and often no
  // Employee record at all, so it lands on its recruitment pipeline instead.
  if (!isHrRole && user?.role === "HIRING_MANAGER") {
    return <Navigate to="/recruitment" replace />;
  }
  return <Navigate to={isHrRole ? "/dashboard" : "/me"} replace />;
}
