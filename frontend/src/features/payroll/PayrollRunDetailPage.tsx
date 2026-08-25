import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { StatTile } from "@/components/StatTile";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatCount, formatMoney } from "@/lib/format";
import {
  approvePayrollRun,
  calculatePayrollRun,
  getPayrollRun,
  markPayrollRunPaid,
} from "@/features/payroll/api";

export function PayrollRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const runId = id!;
  const queryClient = useQueryClient();

  const { data: run, isLoading, isError, error } = useQuery({
    queryKey: ["payroll", "runs", runId],
    queryFn: () => getPayrollRun(runId),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["payroll", "runs"] });
  }

  const calculateMutation = useMutation({ mutationFn: () => calculatePayrollRun(runId), onSuccess: invalidate });
  const approveMutation = useMutation({ mutationFn: () => approvePayrollRun(runId), onSuccess: invalidate });
  const markPaidMutation = useMutation({ mutationFn: () => markPayrollRunPaid(runId), onSuccess: invalidate });
  const actionError = calculateMutation.error ?? approveMutation.error ?? markPaidMutation.error;
  const isActionPending =
    calculateMutation.isPending || approveMutation.isPending || markPaidMutation.isPending;

  if (isLoading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
  }
  if (isError || !run) {
    return (
      <p className="text-sm text-rose-600 dark:text-rose-400">
        {getApiErrorMessage(error, "Could not load this payroll run.")}
      </p>
    );
  }

  return (
    <div>
      <Link to="/payroll" className="text-sm text-slate-500 hover:underline dark:text-slate-400">
        ← Payroll
      </Link>

      <div className="mt-2 flex items-start justify-between">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{run.period}</h1>
        <StatusBadge status={run.status} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {(run.status === "DRAFT" || run.status === "CALCULATED") && (
          <button
            type="button"
            onClick={() => calculateMutation.mutate()}
            disabled={isActionPending}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
          >
            {calculateMutation.isPending
              ? "Calculating…"
              : run.status === "DRAFT"
                ? "Calculate"
                : "Recalculate"}
          </button>
        )}
        {run.status === "CALCULATED" && (
          <button
            type="button"
            onClick={() => approveMutation.mutate()}
            disabled={isActionPending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {approveMutation.isPending ? "Approving…" : "Approve"}
          </button>
        )}
        {run.status === "CALCULATED" && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Approving releases payslips to employees.
          </span>
        )}
        {run.status === "APPROVED" && (
          <button
            type="button"
            onClick={() => markPaidMutation.mutate()}
            disabled={isActionPending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {markPaidMutation.isPending ? "Marking paid…" : "Mark as paid"}
          </button>
        )}
      </div>
      {actionError && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(actionError, "That action failed.")}
        </p>
      )}

      {run.totals && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Employees" value={formatCount(run.totals.employeeCount)} />
          <StatTile label="Gross total" value={formatMoney(run.totals.grossTotal)} />
          <StatTile label="Deductions total" value={formatMoney(run.totals.deductionsTotal)} />
          <StatTile label="Net total" value={formatMoney(run.totals.netTotal)} />
        </div>
      )}

      {run.items && run.items.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                  Employee
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400">
                  Gross
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400">
                  Deductions
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400">
                  Net
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {run.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
                    {item.employee.employeeNo}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">
                    {formatMoney(Number(item.gross))}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">
                    {formatMoney(Number(item.deductions))}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-slate-900 dark:text-slate-100">
                    {formatMoney(Number(item.net))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
