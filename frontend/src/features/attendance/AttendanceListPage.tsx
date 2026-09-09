import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pagination } from "@/components/Pagination";
import { getApiErrorMessage } from "@/lib/api/client";
import { captureLocation } from "@/lib/geolocation";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthContext";
import { checkIn, checkOut, listAttendance } from "@/features/attendance/api";
import { CorrectionForm } from "@/features/attendance/CorrectionForm";
import type { AttendanceRecord } from "@/features/attendance/types";
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

  // HLD v1.1 §15 / Handbook v1.1 §9.3 — location is captured at the moment of
  // the action, never blocks it, and is simply omitted on denial/timeout.
  const checkInMutation = useMutation({
    mutationFn: async () => checkIn(await captureLocation()),
    onSuccess: invalidateList,
  });
  const checkOutMutation = useMutation({
    mutationFn: async () => checkOut(await captureLocation()),
    onSuccess: invalidateList,
  });

  function handleFilterChange(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">
            {isHrRole ? "Records across the organization." : "Your check-in/out history."}
          </p>
        </div>
        {!isHrRole && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
              className="btn-primary"
            >
              Check in
            </button>
            <button
              type="button"
              onClick={() => checkOutMutation.mutate()}
              disabled={checkOutMutation.isPending}
              className="btn-secondary"
            >
              Check out
            </button>
          </div>
        )}
      </div>

      {(checkInMutation.isError || checkOutMutation.isError) && (
        <p className="mt-2 error-text">
          {getApiErrorMessage(checkInMutation.error ?? checkOutMutation.error, "That action failed.")}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {isHrRole && (
          <select
            value={employeeId}
            onChange={(e) => handleFilterChange(setEmployeeId, e.target.value)}
            className="input-field"
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
          className="input-field"
        />
        <span className="self-center text-sm text-slate-400 dark:text-slate-500">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => handleFilterChange(setTo, e.target.value)}
          className="input-field"
        />
      </div>

      {isLoading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-6 error-text">
          {getApiErrorMessage(error, "Could not load attendance records.")}
        </p>
      )}

      {data && (
        <div className="mt-4 overflow-hidden card-table">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="table-head-cell">
                  Date
                </th>
                {isHrRole && (
                  <th className="table-head-cell">
                    Employee
                  </th>
                )}
                <th className="table-head-cell">
                  Check in
                </th>
                <th className="table-head-cell">
                  Check out
                </th>
                <th className="table-head-cell">
                  Duration
                </th>
                <th className="table-head-cell">
                  Location
                </th>
                {isHrRole && (
                  <th className="table-head-cell">
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
                    colSpan={isHrRole ? 8 : 5}
                    className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500"
                  >
                    No attendance records match these filters.
                  </td>
                </tr>
              )}
              {data.items.map((record) => (
                <Fragment key={record.id}>
                  <tr className="row-hover">
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
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      <LocationBadge record={record} />
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
                          className="btn-text"
                        >
                          Correct
                        </button>
                      </td>
                    )}
                  </tr>
                  {isHrRole && correctingId === record.id && (
                    <tr>
                      <td colSpan={8} className="bg-slate-50 p-0 dark:bg-slate-800/50">
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

// Handbook v1.1 §9.3/§9.4 — list views show a presence indicator, not raw
// coordinates; the exact lat/lng is only in the hover tooltip as a light
// "detail" affordance rather than a dedicated map view.
function LocationBadge({ record }: { record: AttendanceRecord }) {
  if (record.locationSource !== "GPS") {
    return <span>—</span>;
  }

  const parts: string[] = [];
  if (record.checkInLat !== null && record.checkInLng !== null) {
    parts.push(`Check-in: ${record.checkInLat.toFixed(5)}, ${record.checkInLng.toFixed(5)}`);
  }
  if (record.checkOutLat !== null && record.checkOutLng !== null) {
    parts.push(`Check-out: ${record.checkOutLat.toFixed(5)}, ${record.checkOutLng.toFixed(5)}`);
  }

  return (
    <span title={parts.join(" · ") || "Location captured"} className="cursor-help">
      📍 Located
    </span>
  );
}
