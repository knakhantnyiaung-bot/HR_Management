import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { useAuth } from "@/features/auth/AuthContext";
import type { UserRole } from "@/features/auth/types";

// Layout route: gates every nested route on an authenticated session, then
// renders <Outlet/>. Nest a second <ProtectedRoute roles={[...]} /> to also
// gate a subtree by role (see AppRoutes).
export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <FullPageSpinner />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

// Keeps an already-authenticated user off /login instead of showing it again.
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <FullPageSpinner />;
  }
  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
