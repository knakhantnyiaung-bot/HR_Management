import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Banknote,
  CalendarClock,
  ClipboardList,
  Settings,
  Timer,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { StatTile } from "@/components/StatTile";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchHrDashboard } from "@/features/dashboard/api";
import { formatCount, formatMoney } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api/client";

const QUICK_ACTIONS = [
  { to: "/leave", label: "Review leave requests", icon: ClipboardList },
  { to: "/overtime", label: "Review overtime requests", icon: Timer },
  { to: "/payroll", label: "Manage payroll", icon: Banknote },
  { to: "/employees", label: "Manage employees", icon: Users },
  { to: "/settings", label: "Organization settings", icon: Settings },
];

export function HrDashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard", "hr"],
    queryFn: fetchHrDashboard,
  });

  return (
    <div>
      <h1 className="page-title">HR Dashboard</h1>
      <p className="page-subtitle">Organization-wide operational snapshot.</p>

      {isLoading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

      {isError && <p className="mt-6 error-text">{getApiErrorMessage(error, "Could not load the dashboard.")}</p>}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Active employees"
              value={formatCount(data.activeEmployees)}
              icon={Users}
              tone="brand"
            />
            <StatTile
              label="Present today"
              value={formatCount(data.presentToday)}
              icon={UserCheck}
              tone="success"
              progress={{ value: data.presentToday, max: data.activeEmployees }}
              hint={
                data.activeEmployees > 0
                  ? `${Math.round((data.presentToday / data.activeEmployees) * 100)}% of active staff`
                  : undefined
              }
            />
            <StatTile
              label="On leave today"
              value={formatCount(data.onLeave)}
              icon={CalendarClock}
              tone="info"
            />
            <StatTile
              label="Pending leave requests"
              value={formatCount(data.pendingLeave)}
              icon={ClipboardList}
              tone="warning"
              attention={data.pendingLeave > 0}
            />
            <StatTile
              label="Pending OT requests"
              value={formatCount(data.pendingOT)}
              icon={Timer}
              tone="warning"
              attention={data.pendingOT > 0}
            />
            <div className={`card ${data.currentPayroll.status ? "" : "card-attention"}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="eyebrow">Current payroll</p>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{data.currentPayroll.period}</p>
              <div className="mt-2">
                {data.currentPayroll.status ? (
                  <StatusBadge status={data.currentPayroll.status} />
                ) : (
                  <span className="text-sm text-slate-400 dark:text-slate-500">No run yet</span>
                )}
              </div>
            </div>
            <StatTile
              label="Payroll cost (net)"
              value={data.payrollCost.amount !== null ? formatMoney(data.payrollCost.amount) : "—"}
              icon={Banknote}
              tone="brand"
            />
          </div>

          <section className="mt-8">
            <h2 className="eyebrow">Quick actions</h2>
            <div className="card mt-2 grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <action.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {action.label}
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
