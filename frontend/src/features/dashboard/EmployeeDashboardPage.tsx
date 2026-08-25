import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatTile } from "@/components/StatTile";
import { fetchEmployeeDashboard } from "@/features/dashboard/api";
import { checkIn, checkOut } from "@/features/attendance/api";
import { formatMoney, formatDateTime, formatTime } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api/client";

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
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">My Dashboard</h1>
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
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
              <div className="mt-3">
                {!data.attendanceToday || data.attendanceToday.checkOut ? (
                  <button
                    type="button"
                    onClick={() => checkInMutation.mutate()}
                    disabled={checkInMutation.isPending}
                    className="rounded-md bg-indigo-600 transition-colors hover:bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                  >
                    {checkInMutation.isPending ? "Checking in…" : "Check in"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => checkOutMutation.mutate()}
                    disabled={checkOutMutation.isPending}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                  >
                    {checkOutMutation.isPending ? "Checking out…" : "Check out"}
                  </button>
                )}
              </div>
              {attendanceError && (
                <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                  {getApiErrorMessage(attendanceError, "That action failed.")}
                </p>
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
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 shadow-sm dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
                      <tr key={balance.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
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
              <div className="mt-2 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
