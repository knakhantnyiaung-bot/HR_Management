import { useQuery } from "@tanstack/react-query";
import { StatTile } from "@/components/StatTile";
import { fetchEmployeeDashboard } from "@/features/dashboard/api";
import { formatMoney, formatDateTime, formatTime } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api/client";

export function EmployeeDashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard", "me"],
    queryFn: fetchEmployeeDashboard,
  });

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">My Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Today's status, leave balances, and requests.
      </p>

      {isLoading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

      {isError && (
        <p className="mt-6 text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(error, "Could not load your dashboard.")}
        </p>
      )}

      {data && (
        <div className="mt-6 space-y-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-500 dark:text-slate-400">Today's attendance</p>
              {data.attendanceToday ? (
                <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                  Checked in {formatTime(data.attendanceToday.checkIn)}
                  {data.attendanceToday.checkOut
                    ? ` · out ${formatTime(data.attendanceToday.checkOut)}`
                    : " · still checked in"}
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">Not checked in yet</p>
              )}
            </div>
            <StatTile label="Pending leave requests" value={data.pendingRequests.leave} />
            <StatTile label="Pending OT requests" value={data.pendingRequests.overtime} />
          </div>

          <section>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Leave balances
            </h2>
            {data.leaveBalances.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">
                No leave balances for this period.
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                        Leave type
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400 [font-variant-numeric:tabular-nums]">
                        Entitled
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400 [font-variant-numeric:tabular-nums]">
                        Used
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400 [font-variant-numeric:tabular-nums]">
                        Remaining
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {data.leaveBalances.map((balance) => (
                      <tr key={balance.id}>
                        <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
                          {balance.leaveType.name}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-700 [font-variant-numeric:tabular-nums] dark:text-slate-300">
                          {balance.entitled}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-700 [font-variant-numeric:tabular-nums] dark:text-slate-300">
                          {balance.used}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-slate-900 [font-variant-numeric:tabular-nums] dark:text-slate-100">
                          {balance.remaining}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Latest payslip
            </h2>
            {data.latestPayslip ? (
              <div className="mt-2 rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-slate-500 dark:text-slate-400">
                  {data.latestPayslip.payrollItem.payrollRun.period} · released{" "}
                  {formatDateTime(data.latestPayslip.releasedAt)}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatMoney(Number(data.latestPayslip.payrollItem.net))}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Net pay</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">
                No payslip has been released yet.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
