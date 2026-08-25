import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? "font-medium text-slate-900 dark:text-slate-100"
    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100";
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isHrRole = user?.role === "HR_ADMIN" || user?.role === "SUPER_ADMIN";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              HR &amp; Payroll
            </span>
            <nav className="flex items-center gap-4 text-sm">
              {isHrRole && (
                <>
                  <NavLink to="/dashboard" className={navLinkClass}>
                    HR Dashboard
                  </NavLink>
                  <NavLink to="/employees" className={navLinkClass}>
                    Employees
                  </NavLink>
                  <NavLink to="/payroll" className={navLinkClass}>
                    Payroll
                  </NavLink>
                  <NavLink to="/settings" className={navLinkClass}>
                    Settings
                  </NavLink>
                </>
              )}
              {user?.employee && (
                <NavLink to="/me" className={navLinkClass}>
                  My Dashboard
                </NavLink>
              )}
              {(isHrRole || user?.employee) && (
                <NavLink to="/attendance" className={navLinkClass}>
                  Attendance
                </NavLink>
              )}
              {(isHrRole || user?.employee) && (
                <NavLink to="/leave" className={navLinkClass}>
                  Leave
                </NavLink>
              )}
              {(isHrRole || user?.employee) && (
                <NavLink to="/overtime" className={navLinkClass}>
                  Overtime
                </NavLink>
              )}
              {(isHrRole || user?.employee) && (
                <NavLink to="/payslips" className={navLinkClass}>
                  Payslips
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500 dark:text-slate-400">{user?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
