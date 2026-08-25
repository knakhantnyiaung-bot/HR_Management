import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SelectField } from "@/components/form/SelectField";
import { TextField } from "@/components/form/TextField";
import { getApiErrorMessage } from "@/lib/api/client";
import { grantLeaveBalance, listLeaveBalances, listLeaveTypes } from "@/features/leave/api";
import { listEmployees } from "@/features/employees/api";

const grantSchema = z.object({
  employeeId: z.string().uuid("Select an employee"),
  leaveTypeId: z.string().uuid("Select a leave type"),
  period: z.string().min(1, "Required"),
  entitled: z.coerce.number().min(0),
});

type GrantForm = z.infer<typeof grantSchema>;

export function LeaveBalancesAdmin() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState("");

  const { data: employees } = useQuery({
    queryKey: ["employees", "picker"],
    queryFn: () => listEmployees({ page: 1, pageSize: 100 }),
  });
  const { data: leaveTypes } = useQuery({ queryKey: ["leave", "types"], queryFn: listLeaveTypes });

  const { data: balances, isLoading } = useQuery({
    queryKey: ["leave", "balances", employeeFilter],
    queryFn: () => listLeaveBalances({ employeeId: employeeFilter || undefined }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GrantForm>({
    resolver: zodResolver(grantSchema),
    defaultValues: { period: String(new Date().getFullYear()) },
  });

  const grantMutation = useMutation({
    mutationFn: grantLeaveBalance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave", "balances"] });
      reset({ employeeId: "", leaveTypeId: "", period: String(new Date().getFullYear()), entitled: 0 });
      setShowForm(false);
    },
  });

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Leave balances</h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm text-slate-500 hover:underline dark:text-slate-400"
          >
            Grant balance
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit((values) => grantMutation.mutate(values))}
          className="mt-2 space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Employee"
              registration={register("employeeId")}
              placeholder="Select an employee"
              options={(employees?.items ?? []).map((e) => ({
                value: e.id,
                label: `${e.employeeNo} · ${e.user.email}`,
              }))}
              error={errors.employeeId?.message}
            />
            <SelectField
              label="Leave type"
              registration={register("leaveTypeId")}
              placeholder="Select a leave type"
              options={(leaveTypes ?? []).map((t) => ({ value: t.id, label: t.name }))}
              error={errors.leaveTypeId?.message}
            />
            <TextField label="Period (e.g. year)" registration={register("period")} error={errors.period?.message} />
            <TextField
              label="Entitled days"
              type="number"
              registration={register("entitled")}
              error={errors.entitled?.message}
            />
          </div>

          {grantMutation.isError && (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {getApiErrorMessage(grantMutation.error, "Could not grant the balance.")}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={grantMutation.isPending}
              className="rounded-md bg-indigo-600 transition-colors hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              {grantMutation.isPending ? "Saving…" : "Grant"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-slate-500 hover:underline dark:text-slate-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-4">
        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">All employees</option>
          {employees?.items.map((e) => (
            <option key={e.id} value={e.id}>
              {e.employeeNo} · {e.user.email}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {balances && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 shadow-sm dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Period
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Leave type
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400">
                  Entitled
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400">
                  Used
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400">
                  Remaining
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {balances.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    No balances match this filter.
                  </td>
                </tr>
              )}
              {balances.map((balance) => (
                <tr key={balance.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{balance.period}</td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                    {balance.leaveType.name}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                    {balance.entitled}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                    {balance.used}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                    {balance.remaining}
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
