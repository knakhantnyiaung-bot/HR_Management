import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/app/layouts/AppLayout";
import { ProtectedRoute, PublicOnlyRoute } from "@/app/routes/ProtectedRoute";
import { RoleBasedHome } from "@/app/routes/RoleBasedHome";
import { LoginPage } from "@/features/auth/LoginPage";
import { AttendanceListPage } from "@/features/attendance/AttendanceListPage";
import { EmployeeDashboardPage } from "@/features/dashboard/EmployeeDashboardPage";
import { HrDashboardPage } from "@/features/dashboard/HrDashboardPage";
import { EmployeeCreatePage } from "@/features/employees/EmployeeCreatePage";
import { EmployeeDetailPage } from "@/features/employees/EmployeeDetailPage";
import { EmployeesListPage } from "@/features/employees/EmployeesListPage";

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
            <Route path="/employees" element={<EmployeesListPage />} />
            <Route path="/employees/new" element={<EmployeeCreatePage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          </Route>

          <Route path="/me" element={<EmployeeDashboardPage />} />
          <Route path="/attendance" element={<AttendanceListPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
