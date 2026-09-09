import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Banknote,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock,
  FileText,
  Info,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Package,
  Receipt,
  Settings,
  Timer,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { NotificationBell } from "@/features/notifications/NotificationBell";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

function sidebarLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
    isActive
      ? "bg-indigo-50 font-semibold text-indigo-700 shadow-sm shadow-indigo-900/5 dark:bg-indigo-500/15 dark:text-indigo-300 dark:shadow-none"
      : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
  ].join(" ");
}

function initialsFromEmail(email: string | undefined): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "?";
}

function roleLabel(role: string | undefined): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super admin";
    case "HR_ADMIN":
      return "HR admin";
    case "HIRING_MANAGER":
      return "Hiring manager";
    case "EMPLOYEE":
      return "Employee";
    default:
      return "";
  }
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-xs font-semibold text-white shadow-sm dark:from-indigo-400 dark:to-indigo-600">
          {initialsFromEmail(user?.email)}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-popover dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user?.email}</p>
            {user?.role && (
              <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {roleLabel(user.role)}
              </span>
            )}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-danger-50 hover:text-danger-600 dark:text-slate-300 dark:hover:bg-danger-500/10 dark:hover:text-danger-400"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isHrRole = user?.role === "HR_ADMIN" || user?.role === "SUPER_ADMIN";

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSidebarOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const navItems: NavItem[] = [];
  if (isHrRole) {
    navItems.push(
      { to: "/dashboard", label: "HR Dashboard", icon: LayoutDashboard },
      { to: "/employees", label: "Employees", icon: Users },
      { to: "/payroll", label: "Payroll", icon: Banknote },
      { to: "/settings", label: "Settings", icon: Settings },
    );
  }
  if (user?.employee) {
    navItems.push({ to: "/me", label: "My Dashboard", icon: LayoutDashboard });
  }
  if (isHrRole || user?.employee) {
    navItems.push(
      { to: "/attendance", label: "Attendance", icon: Clock },
      { to: "/leave", label: "Leave", icon: CalendarDays },
      { to: "/overtime", label: "Overtime", icon: Timer },
      { to: "/payslips", label: "Payslips", icon: FileText },
      { to: "/expenses", label: "Expenses", icon: Receipt },
      { to: "/assets", label: "Assets", icon: Package },
    );
  }
  if (isHrRole || user?.role === "HIRING_MANAGER") {
    navItems.push({ to: "/recruitment", label: "Recruitment", icon: Briefcase });
  }
  navItems.push(
    { to: "/about", label: "About", icon: Info },
    { to: "/contact", label: "Contact", icon: Mail },
  );

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200/80 bg-white/85 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <Link
              to="/"
              className="flex shrink-0 items-center gap-2 rounded-lg text-sm font-semibold tracking-tight text-slate-900 transition-opacity hover:opacity-80 dark:text-slate-100"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm dark:from-indigo-400 dark:to-indigo-600">
                <Building2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="hidden sm:inline">HR &amp; Payroll</span>
            </Link>
          </div>
          <nav className="hidden shrink-0 items-center gap-1 md:flex">
            <NavLink
              to="/about"
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-indigo-700 dark:text-indigo-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`
              }
            >
              About
            </NavLink>
            <NavLink
              to="/contact"
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-indigo-700 dark:text-indigo-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`
              }
            >
              Contact
            </NavLink>
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r border-slate-200/80 bg-white shadow-popover transition-transform duration-200 dark:border-slate-800/80 dark:bg-slate-900 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!sidebarOpen}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3.5 dark:border-slate-800/80">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg text-sm font-semibold tracking-tight text-slate-900 transition-opacity hover:opacity-80 dark:text-slate-100"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm dark:from-indigo-400 dark:to-indigo-600">
              <Building2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>HR &amp; Payroll</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={sidebarLinkClass}>
              <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 pb-20">
        <Outlet />
      </main>

      <footer className="shrink-0 border-t border-slate-200/80 bg-white/60 dark:border-slate-800/80 dark:bg-slate-950/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:px-6">
          <p>&copy; {new Date().getFullYear()} HR &amp; Payroll Platform. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/about" className="transition-colors hover:text-slate-800 dark:hover:text-slate-200">
              About
            </Link>
            <Link to="/contact" className="transition-colors hover:text-slate-800 dark:hover:text-slate-200">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
