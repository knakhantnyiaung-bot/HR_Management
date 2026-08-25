import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/app/layouts/AppLayout";
import { ProtectedRoute, PublicOnlyRoute } from "@/app/routes/ProtectedRoute";
import { RoleBasedHome } from "@/app/routes/RoleBasedHome";
import { LoginPage } from "@/features/auth/LoginPage";
import { EmployeeDashboardPage } from "@/features/dashboard/EmployeeDashboardPage";
import { HrDashboardPage } from "@/features/dashboard/HrDashboardPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<RoleBasedHome />} />

          <Route element={<ProtectedRoute roles={["HR_ADMIN", "SUPER_ADMIN"]} />}>
            <Route path="/dashboard" element={<HrDashboardPage />} />
          </Route>

          <Route path="/me" element={<EmployeeDashboardPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
