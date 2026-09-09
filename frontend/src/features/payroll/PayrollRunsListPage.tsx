import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatMoney } from "@/lib/format";
import { createPayrollRun, listPayrollRuns } from "@/features/payroll/api";
import type { PayrollRunStatus } from "@/types/payroll";

const PAGE_SIZE = 20;
const STATUS_OPTIONS: PayrollRunStatus[] = ["DRAFT", "CALCULATED", "APPROVED", "PAID"];

const newRunSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Select a month"),
});
type NewRunForm = z.infer<typeof newRunSchema>;

export function PayrollRunsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PayrollRunStatus | "">("");
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["payroll", "runs", { page, status }],
    queryFn: () => listPayrollRuns({ page, pageSize: PAGE_SIZE, status: status || undefined }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewRunForm>({ resolver: zodResolver(newRunSchema) });

  const createMutation = useMutation({
    mutationFn: (values: NewRunForm) => createPayrollRun(values.period),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ["payroll", "runs"] });
      navigate(`/payroll/${run.id}`);
    },
  });

  function handleStatusChange(value: string) {
    setStatus(value as PayrollRunStatus | "");
    setPage(1);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="page-subtitle">
            Monthly runs, calculation, and approval.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            New run
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          className="mt-4 flex items-end gap-3 card"
        >
          <div>
            <label className="label-field">
              Period
            </label>
            <input
              type="month"
              className="input-field-inset"
              {...register("period")}
            />
            {errors.period && (
              <p className="field-error-text">{errors.period.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn-primary"
          >
            {createMutation.isPending ? "Creating…" : "Create"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="btn-text pb-2"
          >
            Cancel
          </button>
        </form>
      )}
      {createMutation.isError && (
        <p className="mt-2 error-text">
          {getApiErrorMessage(createMutation.error, "Could not create the payroll run.")}
        </p>
      )}

      <div className="mt-6">
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
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

      {isLoading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-6 error-text">
          {getApiErrorMessage(error, "Could not load payroll runs.")}
        </p>
      )}

      {data && (
        <div className="mt-4 overflow-hidden card-table">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="table-head-cell">
                  Period
                </th>
                <th className="table-head-cell">
                  Status
                </th>
                <th className="table-head-cell">
                  Employees
                </th>
                <th className="table-head-cell text-right">
                  Net total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    No payroll runs match these filters.
                  </td>
                </tr>
              )}
              {data.items.map((run) => (
                <tr key={run.id} className="row-hover">
                  <td className="px-4 py-3">
                    <Link
                      to={`/payroll/${run.id}`}
                      className="link-accent"
                    >
                      {run.period}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {run.totals?.employeeCount ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                    {run.totals ? formatMoney(run.totals.netTotal) : "—"}
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
    </div>
  );
}
