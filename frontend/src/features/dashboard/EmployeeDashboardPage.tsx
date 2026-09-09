import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, Clock, FileText, LogIn, LogOut as LogOutIcon, Timer } from "lucide-react";
import { StatTile } from "@/components/StatTile";
import { ProgressBar } from "@/components/ProgressBar";
import { EmptyState } from "@/components/EmptyState";
import { fetchEmployeeDashboard } from "@/features/dashboard/api";
import { checkIn, checkOut } from "@/features/attendance/api";
import { formatMoney, formatDateTime, formatTime } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api/client";

const QUICK_LINKS = [
  { to: "/attendance", label: "Attendance", icon: Clock },
  { to: "/leave", label: "Leave", icon: CalendarDays },
  { to: "/overtime", label: "Overtime", icon: Timer },
  { to: "/payslips", label: "Payslips", icon: FileText },
];

export function EmployeeDashboardPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard", "me"],
    queryFn: fetchEmployeeDashboard,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["dashboard", "me"] });
    queryClient.invalidateQueries({ queryKey: ["attendance"] });
  }

  const checkInMutation = useMutation({ mutationFn: checkIn, onSuccess: invalidate });
  const checkOutMutation = useMutation({ mutationFn: checkOut, onSuccess: invalidate });
  const attendanceError = checkInMutation.error ?? checkOutMutation.error;

  return (
    <div>
      <h1 className="page-title">My Dashboard</h1>
      <p className="page-subtitle">Today's status, leave balances, and requests.</p>

      {isLoading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

      {isError && <p className="mt-6 error-text">{getApiErrorMessage(error, "Could not load your dashboard.")}</p>}

      {data && (
        <div className="mt-6 space-y-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card">
              <div className="flex items-start justify-between gap-3">
                <p className="eyebrow">Today's attendance</p>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              {data.attendanceToday ? (
                <p className="mt-2 text-sm text-slate-900 dark:text-slate-100">
                  Checked in {formatTime(data.attendanceToday.checkIn)}
                  {data.attendanceToday.checkOut
                    ? ` · out ${formatTime(data.attendanceToday.checkOut)}`
                    : " · still checked in"}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">Not checked in yet</p>
              )}
              <div className="mt-3">
                {!data.attendanceToday || data.attendanceToday.checkOut ? (
                  <button
                    type="button"
                    onClick={() => checkInMutation.mutate()}
                    disabled={checkInMutation.isPending}
                    className="btn-primary"
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    {checkInMutation.isPending ? "Checking in…" : "Check in"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => checkOutMutation.mutate()}
                    disabled={checkOutMutation.isPending}
                    className="btn-secondary"
                  >
                    <LogOutIcon className="h-4 w-4" aria-hidden="true" />
                    {checkOutMutation.isPending ? "Checking out…" : "Check out"}
                  </button>
                )}
              </div>
              {attendanceError && (
                <p className="mt-2 field-error-text">{getApiErrorMessage(attendanceError, "That action failed.")}</p>
              )}
            </div>
            <StatTile
              label="Pending leave requests"
              value={data.pendingRequests.leave}
              icon={CalendarDays}
              tone="warning"
              attention={data.pendingRequests.leave > 0}
            />
            <StatTile
              label="Pending OT requests"
              value={data.pendingRequests.overtime}
              icon={Timer}
              tone="warning"
              attention={data.pendingRequests.overtime > 0}
            />
          </div>

          <section>
            <h2 className="eyebrow">Leave balances</h2>
            {data.leaveBalances.length === 0 ? (
              <div className="mt-2">
                <EmptyState
                  icon={CalendarDays}
                  title="No leave balances for this period."
                  description="Balances appear once HR sets up your leave entitlements."
                  action={{ label: "Request leave", to: "/leave" }}
                  compact
                />
              </div>
            ) : (
              <div className="mt-2 card-table overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="table-head-cell">Leave type</th>
                      <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400 [font-variant-numeric:tabular-nums]">
                        Entitled
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400 [font-variant-numeric:tabular-nums]">
                        Used
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400 [font-variant-numeric:tabular-nums]">
                        Remaining
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Used %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {data.leaveBalances.map((balance) => {
                      const entitled = Number(balance.entitled);
                      const used = Number(balance.used);
                      return (
                        <tr key={balance.id} className="row-hover">
                          <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                            {balance.leaveType.name}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 [font-variant-numeric:tabular-nums] dark:text-slate-300">
                            {balance.entitled}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 [font-variant-numeric:tabular-nums] dark:text-slate-300">
                            {balance.used}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900 [font-variant-numeric:tabular-nums] dark:text-slate-100">
                            {balance.remaining}
                          </td>
                          <td className="w-40 px-4 py-3">
                            <ProgressBar
                              value={used}
                              max={entitled}
                              tone={entitled > 0 && used / entitled >= 0.8 ? "warning" : "brand"}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="eyebrow">Latest payslip</h2>
            {data.latestPayslip ? (
              <div className="card mt-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-slate-500 dark:text-slate-400">
                    {data.latestPayslip.payrollItem.payrollRun.period} · released{" "}
                    {formatDateTime(data.latestPayslip.releasedAt)}
                  </p>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {formatMoney(Number(data.latestPayslip.payrollItem.net))}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Net pay</p>
              </div>
            ) : (
              <div className="mt-2">
                <EmptyState
                  icon={FileText}
                  title="No payslip has been released yet."
                  description="Once HR releases a payslip for you, it'll show up here."
                  action={{ label: "View payslips", to: "/payslips" }}
                  compact
                />
              </div>
            )}
          </section>

          <section>
            <h2 className="eyebrow">Quick links</h2>
            <div className="card mt-2 grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <link.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
