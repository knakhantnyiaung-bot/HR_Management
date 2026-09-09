import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { cancelOvertimeRequest, listOvertimeRequests } from "@/features/overtime/api";
import { OvertimeRequestForm } from "@/features/overtime/OvertimeRequestForm";
import type { OvertimeRequestStatus } from "@/features/overtime/types";

// Unlike leave, APPROVED overtime is terminal (HLD section 12: once
// approved it's eligible for payroll and isn't reversed through the
// ordinary cancel endpoint) — only PENDING can still be cancelled.
const CANCELLABLE: OvertimeRequestStatus[] = ["PENDING"];

export function MyOvertimeRequests({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["overtime", "requests", "mine", employeeId],
    queryFn: () => listOvertimeRequests({ page: 1, pageSize: 50, employeeId }),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelOvertimeRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["overtime", "requests"] }),
  });

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          My overtime requests
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
          <OvertimeRequestForm onDone={() => setShowForm(false)} />
        </div>
      )}

      {isLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-2 error-text">
          {getApiErrorMessage(error, "Could not load your overtime requests.")}
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
                  Start
                </th>
                <th className="table-head-cell">
                  End
                </th>
                <th className="table-head-cell">
                  Hours
                </th>
                <th className="table-head-cell">
                  Multiplier
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
                    No overtime requests yet.
                  </td>
                </tr>
              )}
              {data.items.map((request) => (
                <tr key={request.id} className="row-hover">
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {formatDateTime(request.startTime)}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {formatDateTime(request.endTime)}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{request.hours}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {request.multiplier}x
                  </td>
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
