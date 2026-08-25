import { useQuery } from "@tanstack/react-query";
import { StatTile } from "@/components/StatTile";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchHrDashboard } from "@/features/dashboard/api";
import { formatCount, formatMoney } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api/client";

export function HrDashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard", "hr"],
    queryFn: fetchHrDashboard,
  });

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">HR Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Organization-wide operational snapshot.
      </p>

      {isLoading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

      {isError && (
        <p className="mt-6 text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(error, "Could not load the dashboard.")}
        </p>
      )}

      {data && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Active employees" value={formatCount(data.activeEmployees)} />
          <StatTile label="Present today" value={formatCount(data.presentToday)} />
          <StatTile label="On leave today" value={formatCount(data.onLeave)} />
          <StatTile label="Pending leave requests" value={formatCount(data.pendingLeave)} />
          <StatTile label="Pending OT requests" value={formatCount(data.pendingOT)} />
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">Current payroll</p>
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
              {data.currentPayroll.period}
            </p>
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
          />
        </div>
      )}
    </div>
  );
}
