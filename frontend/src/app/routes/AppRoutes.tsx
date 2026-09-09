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
import { AboutPage } from "@/features/info/AboutPage";
import { ContactPage } from "@/features/info/ContactPage";
import { LeavePage } from "@/features/leave/LeavePage";
import { SettingsPage } from "@/features/organization/SettingsPage";
import { OvertimePage } from "@/features/overtime/OvertimePage";
import { PayrollRunDetailPage } from "@/features/payroll/PayrollRunDetailPage";
import { PayrollRunsListPage } from "@/features/payroll/PayrollRunsListPage";
import { PayslipDetailPage } from "@/features/payslips/PayslipDetailPage";
import { PayslipsListPage } from "@/features/payslips/PayslipsListPage";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";
import { ExpensesPage } from "@/features/expenses/ExpensesPage";
import { RecruitmentPage } from "@/features/recruitment/RecruitmentPage";
import { ApplicationDetailPage } from "@/features/recruitment/ApplicationDetailPage";

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
            <Route path="/payroll" element={<PayrollRunsListPage />} />
            <Route path="/payroll/:id" element={<PayrollRunDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="/me" element={<EmployeeDashboardPage />} />
          <Route path="/attendance" element={<AttendanceListPage />} />
          <Route path="/leave" element={<LeavePage />} />
          <Route path="/overtime" element={<OvertimePage />} />
          <Route path="/payslips" element={<PayslipsListPage />} />
          <Route path="/payslips/:id" element={<PayslipDetailPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          <Route
            element={<ProtectedRoute roles={["HR_ADMIN", "SUPER_ADMIN", "HIRING_MANAGER"]} />}
          >
            <Route path="/recruitment" element={<RecruitmentPage />} />
            <Route path="/recruitment/applications/:id" element={<ApplicationDetailPage />} />
          </Route>

          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
