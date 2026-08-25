import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  listLeaveRequests,
  rejectLeaveRequest,
} from "@/features/leave/api";
import type { LeaveRequestStatus } from "@/features/leave/types";
import { listEmployees } from "@/features/employees/api";

const PAGE_SIZE = 20;
const STATUS_OPTIONS: LeaveRequestStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
const CANCELLABLE: LeaveRequestStatus[] = ["PENDING", "APPROVED"];

export function HrLeaveRequests() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState<LeaveRequestStatus | "">("");

  const { data: employees } = useQuery({
    queryKey: ["employees", "picker"],
    queryFn: () => listEmployees({ page: 1, pageSize: 100 }),
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["leave", "requests", "all", { page, employeeId, status }],
    queryFn: () =>
      listLeaveRequests({
        page,
        pageSize: PAGE_SIZE,
        employeeId: employeeId || undefined,
        status: status || undefined,
      }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["leave", "requests"] });
  }

  const approveMutation = useMutation({ mutationFn: approveLeaveRequest, onSuccess: invalidate });
  const rejectMutation = useMutation({ mutationFn: rejectLeaveRequest, onSuccess: invalidate });
  const cancelMutation = useMutation({ mutationFn: cancelLeaveRequest, onSuccess: invalidate });
  const actionError =
    approveMutation.error ?? rejectMutation.error ?? cancelMutation.error;
  const isActionPending =
    approveMutation.isPending || rejectMutation.isPending || cancelMutation.isPending;

  function handleFilterChange(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        All leave requests
      </h2>

      <div className="mt-2 flex flex-wrap gap-3">
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
        <select
          value={status}
          onChange={(e) => handleFilterChange(setStatus as (v: string) => void, e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(error, "Could not load leave requests.")}
        </p>
      )}
      {actionError && (
        <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(actionError, "That action failed.")}
        </p>
      )}

      {data && (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Employee
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Dates
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Days
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Status
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    No leave requests match these filters.
                  </td>
                </tr>
              )}
              {data.items.map((request) => (
                <tr key={request.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                    {request.employee.employeeNo}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {request.leaveType.name}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {formatDate(request.startDate)} – {formatDate(request.endDate)}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{request.days}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={request.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      {request.status === "PENDING" && (
                        <>
                          <button
                            type="button"
                            onClick={() => approveMutation.mutate(request.id)}
                            disabled={isActionPending}
                            className="text-sm text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectMutation.mutate(request.id)}
                            disabled={isActionPending}
                            className="text-sm text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-400"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {CANCELLABLE.includes(request.status) && (
                        <button
                          type="button"
                          onClick={() => cancelMutation.mutate(request.id)}
                          disabled={isActionPending}
                          className="text-sm text-slate-500 hover:underline disabled:opacity-50 dark:text-slate-400"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
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
    </section>
  );
}
