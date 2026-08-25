import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TextField } from "@/components/form/TextField";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatMoney } from "@/lib/format";
import {
  getCurrentSalaryProfile,
  listSalaryProfileHistory,
  upsertSalaryProfile,
} from "@/features/employees/api";

const amountRowSchema = z.object({
  key: z.string().min(1, "Required"),
  amount: z.coerce.number(),
});

const salaryFormSchema = z.object({
  basicSalary: z.coerce.number().nonnegative(),
  effectiveFrom: z.string().min(1, "Required"),
  standardMonthlyHours: z.coerce.number().positive().optional().or(z.literal("")),
  standardWorkingDays: z.coerce.number().positive().optional().or(z.literal("")),
  allowances: z.array(amountRowSchema),
  deductions: z.array(amountRowSchema),
});

type SalaryForm = z.infer<typeof salaryFormSchema>;

function recordToRows(record: Record<string, number>): Array<{ key: string; amount: number }> {
  return Object.entries(record).map(([key, amount]) => ({ key, amount }));
}

function rowsToRecord(rows: Array<{ key: string; amount: number }>): Record<string, number> {
  const record: Record<string, number> = {};
  for (const row of rows) {
    if (row.key.trim()) record[row.key.trim()] = row.amount;
  }
  return record;
}

export function SalaryProfileSection({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: current, isLoading: isCurrentLoading } = useQuery({
    queryKey: ["employees", employeeId, "salary-profile"],
    queryFn: () => getCurrentSalaryProfile(employeeId),
    retry: false,
  });

  const { data: history } = useQuery({
    queryKey: ["employees", employeeId, "salary-profile", "history"],
    queryFn: () => listSalaryProfileHistory(employeeId),
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<SalaryForm>({
    resolver: zodResolver(salaryFormSchema),
    defaultValues: {
      basicSalary: 0,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      allowances: [],
      deductions: [],
    },
  });
  const allowanceFields = useFieldArray({ control, name: "allowances" });
  const deductionFields = useFieldArray({ control, name: "deductions" });

  const upsertMutation = useMutation({
    mutationFn: (values: SalaryForm) =>
      upsertSalaryProfile(employeeId, {
        basicSalary: values.basicSalary,
        effectiveFrom: values.effectiveFrom,
        allowances: rowsToRecord(values.allowances),
        deductions: rowsToRecord(values.deductions),
        otSettings:
          values.standardMonthlyHours || values.standardWorkingDays
            ? {
                standardMonthlyHours: values.standardMonthlyHours || undefined,
                standardWorkingDays: values.standardWorkingDays || undefined,
              }
            : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", employeeId, "salary-profile"] });
      setIsEditing(false);
    },
  });

  function startEditing() {
    reset({
      basicSalary: current ? Number(current.basicSalary) : 0,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      standardMonthlyHours: current?.otSettings?.standardMonthlyHours ?? undefined,
      standardWorkingDays: current?.otSettings?.standardWorkingDays ?? undefined,
      allowances: recordToRows(current?.allowances ?? {}),
      deductions: recordToRows(current?.deductions ?? {}),
    });
    setIsEditing(true);
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Salary profile</h2>
        {!isEditing && (
          <button
            type="button"
            onClick={startEditing}
            className="text-sm text-slate-500 hover:underline dark:text-slate-400"
          >
            {current ? "Change salary" : "Set salary"}
          </button>
        )}
      </div>

      {!isEditing && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {isCurrentLoading && <p className="text-slate-400 dark:text-slate-500">Loading…</p>}
          {!isCurrentLoading && !current && (
            <p className="text-slate-400 dark:text-slate-500">No active salary profile.</p>
          )}
          {current && (
            <div className="space-y-1">
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {formatMoney(Number(current.basicSalary))}{" "}
                <span className="text-sm font-normal text-slate-400 dark:text-slate-500">basic</span>
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                Effective from {current.effectiveFrom.slice(0, 10)}
              </p>
              {Object.keys(current.allowances).length > 0 && (
                <p className="text-slate-500 dark:text-slate-400">
                  Allowances:{" "}
                  {Object.entries(current.allowances)
                    .map(([k, v]) => `${k} ${formatMoney(v)}`)
                    .join(", ")}
                </p>
              )}
              {Object.keys(current.deductions).length > 0 && (
                <p className="text-slate-500 dark:text-slate-400">
                  Deductions:{" "}
                  {Object.entries(current.deductions)
                    .map(([k, v]) => `${k} ${formatMoney(v)}`)
                    .join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {isEditing && (
        <form
          onSubmit={handleSubmit((values) => upsertMutation.mutate(values))}
          className="mt-2 space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Basic salary"
              type="number"
              registration={register("basicSalary")}
              error={errors.basicSalary?.message}
            />
            <TextField
              label="Effective from"
              type="date"
              registration={register("effectiveFrom")}
              error={errors.effectiveFrom?.message}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Standard monthly hours (OT basis)"
              type="number"
              registration={register("standardMonthlyHours")}
              error={errors.standardMonthlyHours?.message as string | undefined}
            />
            <TextField
              label="Standard working days (unpaid-leave basis)"
              type="number"
              registration={register("standardWorkingDays")}
              error={errors.standardWorkingDays?.message as string | undefined}
            />
          </div>

          <AmountRows
            label="Allowances"
            fields={allowanceFields.fields}
            register={register}
            name="allowances"
            onAdd={() => allowanceFields.append({ key: "", amount: 0 })}
            onRemove={allowanceFields.remove}
          />
          <AmountRows
            label="Deductions"
            fields={deductionFields.fields}
            register={register}
            name="deductions"
            onAdd={() => deductionFields.append({ key: "", amount: 0 })}
            onRemove={deductionFields.remove}
          />

          {upsertMutation.isError && (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {getApiErrorMessage(upsertMutation.error, "Could not save the salary profile.")}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={upsertMutation.isPending}
              className="rounded-md bg-indigo-600 transition-colors hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              {upsertMutation.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-sm text-slate-500 hover:underline dark:text-slate-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {history && history.length > 1 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            History
          </h3>
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 shadow-sm dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Effective from
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Effective to
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400">
                    Basic salary
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {history.map((profile) => (
                  <tr key={profile.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {profile.effectiveFrom.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {profile.effectiveTo ? profile.effectiveTo.slice(0, 10) : "Ongoing"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                      {formatMoney(Number(profile.basicSalary))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

interface AmountRowsProps {
  label: string;
  name: "allowances" | "deductions";
  fields: Array<{ id: string }>;
  register: ReturnType<typeof useForm<SalaryForm>>["register"];
  onAdd: () => void;
  onRemove: (index: number) => void;
}

function AmountRows({ label, name, fields, register, onAdd, onRemove }: AmountRowsProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
        <button type="button" onClick={onAdd} className="text-xs text-slate-500 hover:underline dark:text-slate-400">
          + Add
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <input
              placeholder="Label (e.g. transport)"
              className="w-1/2 rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              {...register(`${name}.${index}.key` as const)}
            />
            <input
              type="number"
              placeholder="Amount"
              className="w-1/3 rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              {...register(`${name}.${index}.amount` as const)}
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="text-xs text-rose-600 hover:underline dark:text-rose-400"
            >
              Remove
            </button>
          </div>
        ))}
        {fields.length === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500">None</p>
        )}
      </div>
    </div>
  );
}
