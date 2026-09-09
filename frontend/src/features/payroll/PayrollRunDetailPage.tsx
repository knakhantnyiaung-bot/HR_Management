import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Banknote, MinusCircle, Users, Wallet } from "lucide-react";
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
      <p className="error-text">
        {getApiErrorMessage(error, "Could not load this payroll run.")}
      </p>
    );
  }

  return (
    <div>
      <Link to="/payroll" className="btn-text">
        ← Payroll
      </Link>

      <div className="mt-2 flex items-start justify-between">
        <h1 className="page-title">{run.period}</h1>
        <StatusBadge status={run.status} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {(run.status === "DRAFT" || run.status === "CALCULATED") && (
          <button
            type="button"
            onClick={() => calculateMutation.mutate()}
            disabled={isActionPending}
            className="btn-secondary"
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
            className="btn-primary"
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
            className="btn-primary"
          >
            {markPaidMutation.isPending ? "Marking paid…" : "Mark as paid"}
          </button>
        )}
      </div>
      {actionError && (
        <p className="mt-2 error-text">
          {getApiErrorMessage(actionError, "That action failed.")}
        </p>
      )}

      {run.totals && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Employees" value={formatCount(run.totals.employeeCount)} icon={Users} tone="neutral" />
          <StatTile label="Gross total" value={formatMoney(run.totals.grossTotal)} icon={Wallet} tone="info" />
          <StatTile
            label="Deductions total"
            value={formatMoney(run.totals.deductionsTotal)}
            icon={MinusCircle}
            tone="warning"
          />
          <StatTile label="Net total" value={formatMoney(run.totals.netTotal)} icon={Banknote} tone="brand" />
        </div>
      )}

      {run.items && run.items.length > 0 && (
        <div className="mt-6 overflow-x-auto card-table">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="table-head-cell">
                  Employee
                </th>
                <th className="table-head-cell text-right">
                  Gross
                </th>
                <th className="table-head-cell text-right">
                  Deductions
                </th>
                <th className="table-head-cell text-right">
                  Net
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {run.items.map((item) => (
                <tr key={item.id} className="row-hover">
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                    {item.employee.employeeNo}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                    {formatMoney(Number(item.gross))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                    {formatMoney(Number(item.deductions))}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">
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
