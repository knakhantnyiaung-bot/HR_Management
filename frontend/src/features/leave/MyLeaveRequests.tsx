import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { cancelLeaveRequest, listLeaveRequests } from "@/features/leave/api";
import { LeaveRequestForm } from "@/features/leave/LeaveRequestForm";
import type { LeaveRequestStatus } from "@/features/leave/types";

const CANCELLABLE: LeaveRequestStatus[] = ["PENDING", "APPROVED"];

export function MyLeaveRequests({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["leave", "requests", "mine", employeeId],
    queryFn: () => listLeaveRequests({ page: 1, pageSize: 50, employeeId }),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelLeaveRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave", "requests"] }),
  });

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          My leave requests
        </h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            New request
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-2">
          <LeaveRequestForm onDone={() => setShowForm(false)} />
        </div>
      )}

      {isLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-2 error-text">
          {getApiErrorMessage(error, "Could not load your leave requests.")}
        </p>
      )}
      {cancelMutation.isError && (
        <p className="mt-2 error-text">
          {getApiErrorMessage(cancelMutation.error, "Could not cancel the request.")}
        </p>
      )}

      {data && (
        <div className="mt-2 overflow-x-auto card-table">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="table-head-cell">
                  Type
                </th>
                <th className="table-head-cell">
                  Dates
                </th>
                <th className="table-head-cell">
                  Days
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
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    No leave requests yet.
                  </td>
                </tr>
              )}
              {data.items.map((request) => (
                <tr key={request.id} className="row-hover">
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
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
                    {CANCELLABLE.includes(request.status) && (
                      <button
                        type="button"
                        onClick={() => cancelMutation.mutate(request.id)}
                        disabled={cancelMutation.isPending}
                        className="btn-text hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
