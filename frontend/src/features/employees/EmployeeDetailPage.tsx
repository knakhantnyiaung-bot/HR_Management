import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { SelectField } from "@/components/form/SelectField";
import { TextField } from "@/components/form/TextField";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  activateEmployee,
  deactivateEmployee,
  getEmployee,
  terminateEmployee,
  updateEmployee,
} from "@/features/employees/api";
import type { EmployeeStatus } from "@/features/employees/types";
import { SalaryProfileSection } from "@/features/employees/SalaryProfileSection";
import { fetchDepartments, fetchPositions } from "@/features/organization/api";

const ALLOWED_TRANSITIONS: Record<EmployeeStatus, EmployeeStatus[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["INACTIVE", "TERMINATED"],
  INACTIVE: ["ACTIVE", "TERMINATED"],
  TERMINATED: [],
};

const editEmployeeSchema = z.object({
  departmentId: z.string().uuid(),
  positionId: z.string().uuid(),
  workModel: z.enum(["OFFICE", "HYBRID", "REMOTE"]),
  joinDate: z.string().min(1),
});

type EditEmployeeForm = z.infer<typeof editEmployeeSchema>;

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const employeeId = id!;
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingTerminate, setConfirmingTerminate] = useState(false);

  const employeeQuery = useQuery({
    queryKey: ["employees", employeeId],
    queryFn: () => getEmployee(employeeId),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["employees", employeeId] });
    queryClient.invalidateQueries({ queryKey: ["employees"], exact: false });
  }

  const activateMutation = useMutation({ mutationFn: () => activateEmployee(employeeId), onSuccess: invalidate });
  const deactivateMutation = useMutation({
    mutationFn: () => deactivateEmployee(employeeId),
    onSuccess: invalidate,
  });
  const terminateMutation = useMutation({
    mutationFn: () => terminateEmployee(employeeId),
    onSuccess: () => {
      invalidate();
      setConfirmingTerminate(false);
    },
  });

  if (employeeQuery.isLoading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
  }
  if (employeeQuery.isError || !employeeQuery.data) {
    return (
      <p className="text-sm text-rose-600 dark:text-rose-400">
        {getApiErrorMessage(employeeQuery.error, "Could not load this employee.")}
      </p>
    );
  }

  const employee = employeeQuery.data;
  const allowedTargets = ALLOWED_TRANSITIONS[employee.status];
  const lifecycleError = activateMutation.error ?? deactivateMutation.error ?? terminateMutation.error;

  return (
    <div className="max-w-2xl">
      <Link to="/employees" className="text-sm text-slate-500 hover:underline dark:text-slate-400">
        ← Employees
      </Link>

      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {employee.employeeNo}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{employee.user.email}</p>
        </div>
        <StatusBadge status={employee.status} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {allowedTargets.includes("ACTIVE") && (
          <LifecycleButton
            label="Activate"
            onClick={() => activateMutation.mutate()}
            isPending={activateMutation.isPending}
          />
        )}
        {allowedTargets.includes("INACTIVE") && (
          <LifecycleButton
            label="Deactivate"
            onClick={() => deactivateMutation.mutate()}
            isPending={deactivateMutation.isPending}
          />
        )}
        {allowedTargets.includes("TERMINATED") && !confirmingTerminate && (
          <button
            type="button"
            onClick={() => setConfirmingTerminate(true)}
            className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/20"
          >
            Terminate
          </button>
        )}
        {confirmingTerminate && (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Terminate this employee?</span>
            <button
              type="button"
              onClick={() => terminateMutation.mutate()}
              disabled={terminateMutation.isPending}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-white disabled:opacity-50"
            >
              {terminateMutation.isPending ? "Terminating…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingTerminate(false)}
              className="text-slate-500 hover:underline dark:text-slate-400"
            >
              Cancel
            </button>
          </span>
        )}
      </div>
      {lifecycleError && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(lifecycleError, "That action could not be completed.")}
        </p>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Employment</h2>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-sm text-slate-500 hover:underline dark:text-slate-400"
            >
              Edit
            </button>
          )}
        </div>

        {!isEditing ? (
          <dl className="mt-2 grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
            <Field label="Department" value={employee.department.name} />
            <Field label="Position" value={employee.position.title} />
            <Field label="Work model" value={employee.workModel} />
            <Field label="Join date" value={employee.joinDate.slice(0, 10)} />
          </dl>
        ) : (
          <EditEmployeeForm
            employeeId={employeeId}
            defaultValues={{
              departmentId: employee.department.id,
              positionId: employee.position.id,
              workModel: employee.workModel,
              joinDate: employee.joinDate.slice(0, 10),
            }}
            onDone={() => setIsEditing(false)}
          />
        )}
      </div>

      <div className="mt-8">
        <SalaryProfileSection employeeId={employeeId} />
      </div>
    </div>
  );
}

function LifecycleButton({
  label,
  onClick,
  isPending,
}: {
  label: string;
  onClick: () => void;
  isPending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
    >
      {isPending ? "…" : label}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}

function EditEmployeeForm({
  employeeId,
  defaultValues,
  onDone,
}: {
  employeeId: string;
  defaultValues: EditEmployeeForm;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EditEmployeeForm>({ resolver: zodResolver(editEmployeeSchema), defaultValues });
  const departmentId = watch("departmentId");

  const { data: departments } = useQuery({
    queryKey: ["departments", "ACTIVE"],
    queryFn: () => fetchDepartments("ACTIVE"),
  });
  const { data: positions } = useQuery({
    queryKey: ["positions", departmentId],
    queryFn: () => fetchPositions({ departmentId, status: "ACTIVE" }),
    enabled: Boolean(departmentId),
  });

  const updateMutation = useMutation({
    mutationFn: (values: EditEmployeeForm) => updateEmployee(employeeId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employees"], exact: false });
      onDone();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
      className="mt-2 space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Department"
          registration={register("departmentId")}
          options={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
          error={errors.departmentId?.message}
        />
        <SelectField
          label="Position"
          registration={register("positionId")}
          options={(positions ?? []).map((p) => ({ value: p.id, label: p.title }))}
          error={errors.positionId?.message}
        />
        <SelectField
          label="Work model"
          registration={register("workModel")}
          options={[
            { value: "OFFICE", label: "Office" },
            { value: "HYBRID", label: "Hybrid" },
            { value: "REMOTE", label: "Remote" },
          ]}
          error={errors.workModel?.message}
        />
        <TextField
          label="Join date"
          type="date"
          registration={register("joinDate")}
          error={errors.joinDate?.message}
        />
      </div>

      {updateMutation.isError && (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(updateMutation.error, "Could not save these changes.")}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="rounded-md bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {updateMutation.isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-slate-500 hover:underline dark:text-slate-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
