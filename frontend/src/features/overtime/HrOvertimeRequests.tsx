import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import {
  approveOvertimeRequest,
  cancelOvertimeRequest,
  listOvertimeRequests,
  rejectOvertimeRequest,
} from "@/features/overtime/api";
import type { OvertimeRequestStatus } from "@/features/overtime/types";
import { listEmployees } from "@/features/employees/api";

const PAGE_SIZE = 20;
const STATUS_OPTIONS: OvertimeRequestStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
const CANCELLABLE: OvertimeRequestStatus[] = ["PENDING"];

export function HrOvertimeRequests() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState<OvertimeRequestStatus | "">("");

  const { data: employees } = useQuery({
    queryKey: ["employees", "picker"],
    queryFn: () => listEmployees({ page: 1, pageSize: 100 }),
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["overtime", "requests", "all", { page, employeeId, status }],
    queryFn: () =>
      listOvertimeRequests({
        page,
        pageSize: PAGE_SIZE,
        employeeId: employeeId || undefined,
        status: status || undefined,
      }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["overtime", "requests"] });
  }

  const approveMutation = useMutation({ mutationFn: approveOvertimeRequest, onSuccess: invalidate });
  const rejectMutation = useMutation({ mutationFn: rejectOvertimeRequest, onSuccess: invalidate });
  const cancelMutation = useMutation({ mutationFn: cancelOvertimeRequest, onSuccess: invalidate });
  const actionError = approveMutation.error ?? rejectMutation.error ?? cancelMutation.error;
  const isActionPending =
    approveMutation.isPending || rejectMutation.isPending || cancelMutation.isPending;

  function handleFilterChange(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        All overtime requests
      </h2>

      <div className="mt-2 flex flex-wrap gap-3">
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
        <select
          value={status}
          onChange={(e) => handleFilterChange(setStatus as (v: string) => void, e.target.value)}
          className="input-field"
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
        <p className="mt-4 text-sm text-danger-600 dark:text-danger-400">
          {getApiErrorMessage(error, "Could not load overtime requests.")}
        </p>
      )}
      {actionError && (
        <p className="mt-4 text-sm text-danger-600 dark:text-danger-400">
          {getApiErrorMessage(actionError, "That action failed.")}
        </p>
      )}

      {data && (
        <div className="mt-4 overflow-hidden card-table">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="table-head-cell">
                  Employee
                </th>
                <th className="table-head-cell">
                  Start
                </th>
                <th className="table-head-cell">
                  End
                </th>
                <th className="table-head-cell">
                  Hours
                </th>
                <th className="table-head-cell">
                  Status
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    No overtime requests match these filters.
                  </td>
                </tr>
              )}
              {data.items.map((request) => (
                <tr key={request.id} className="row-hover">
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                    {request.employee.employeeNo}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {formatDateTime(request.startTime)}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {formatDateTime(request.endTime)}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{request.hours}</td>
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
                            className="text-sm font-medium text-success-700 hover:underline disabled:opacity-50 dark:text-success-400"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectMutation.mutate(request.id)}
                            disabled={isActionPending}
                            className="text-sm text-danger-600 hover:underline disabled:opacity-50 dark:text-danger-400"
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
                          className="btn-text hover:underline"
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
