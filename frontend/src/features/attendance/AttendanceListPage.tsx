import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pagination } from "@/components/Pagination";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthContext";
import { checkIn, checkOut, listAttendance } from "@/features/attendance/api";
import { CorrectionForm } from "@/features/attendance/CorrectionForm";
import { listEmployees } from "@/features/employees/api";

const PAGE_SIZE = 20;
const HR_ROLES = new Set(["HR_ADMIN", "SUPER_ADMIN"]);

export function AttendanceListPage() {
  const { user } = useAuth();
  const isHrRole = Boolean(user && HR_ROLES.has(user.role));
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [employeeId, setEmployeeId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [correctingId, setCorrectingId] = useState<string | null>(null);

  const { data: employees } = useQuery({
    queryKey: ["employees", "picker"],
    queryFn: () => listEmployees({ page: 1, pageSize: 100 }),
    enabled: isHrRole,
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["attendance", { page, employeeId, from, to }],
    queryFn: () =>
      listAttendance({
        page,
        pageSize: PAGE_SIZE,
        employeeId: employeeId || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  function invalidateList() {
    queryClient.invalidateQueries({ queryKey: ["attendance"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "me"] });
  }

  const checkInMutation = useMutation({ mutationFn: checkIn, onSuccess: invalidateList });
  const checkOutMutation = useMutation({ mutationFn: checkOut, onSuccess: invalidateList });

  function handleFilterChange(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Attendance</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isHrRole ? "Records across the organization." : "Your check-in/out history."}
          </p>
        </div>
        {!isHrRole && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
              className="rounded-md bg-indigo-600 transition-colors hover:bg-indigo-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              Check in
            </button>
            <button
              type="button"
              onClick={() => checkOutMutation.mutate()}
              disabled={checkOutMutation.isPending}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
            >
              Check out
            </button>
          </div>
        )}
      </div>

      {(checkInMutation.isError || checkOutMutation.isError) && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(checkInMutation.error ?? checkOutMutation.error, "That action failed.")}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {isHrRole && (
          <select
            value={employeeId}
            onChange={(e) => handleFilterChange(setEmployeeId, e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">All employees</option>
            {employees?.items.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employeeNo} · {e.user.email}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          value={from}
          onChange={(e) => handleFilterChange(setFrom, e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <span className="self-center text-sm text-slate-400 dark:text-slate-500">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => handleFilterChange(setTo, e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {isLoading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-6 text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(error, "Could not load attendance records.")}
        </p>
      )}

      {data && (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Date
                </th>
                {isHrRole && (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Employee
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Check in
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Check out
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Duration
                </th>
                {isHrRole && (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Correction
                  </th>
                )}
                {isHrRole && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {data.items.length === 0 && (
                <tr>
                  <td
                    colSpan={isHrRole ? 7 : 4}
                    className="px-4 py-6 text-center text-slate-400 dark:text-slate-500"
                  >
                    No attendance records match these filters.
                  </td>
                </tr>
              )}
              {data.items.map((record) => (
                <Fragment key={record.id}>
                  <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {formatDate(record.workDate)}
                    </td>
                    {isHrRole && (
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {record.employee.employeeNo}
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {formatTime(record.checkIn)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {record.checkOut ? formatTime(record.checkOut) : "Still checked in"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {formatDuration(record.workingMinutes)}
                    </td>
                    {isHrRole && (
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {record.correctionNote ?? "—"}
                      </td>
                    )}
                    {isHrRole && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setCorrectingId(correctingId === record.id ? null : record.id)
                          }
                          className="text-sm text-slate-500 hover:underline dark:text-slate-400"
                        >
                          Correct
                        </button>
                      </td>
                    )}
                  </tr>
                  {isHrRole && correctingId === record.id && (
                    <tr>
                      <td colSpan={7} className="bg-slate-50 p-0 dark:bg-slate-800/50">
                        <CorrectionForm
                          record={record}
                          onDone={() => {
                            setCorrectingId(null);
                            invalidateList();
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          <Pagination
            page={data.meta.page}
            pageSize={data.meta.pageSize}
            total={data.meta.total}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
