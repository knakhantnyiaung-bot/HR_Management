import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { TextField } from "@/components/form/TextField";
import { SelectField } from "@/components/form/SelectField";
import { getApiErrorMessage } from "@/lib/api/client";
import { createEmployee } from "@/features/employees/api";
import type { CreateEmployeeResult } from "@/features/employees/types";
import { fetchDepartments, fetchPositions } from "@/features/organization/api";

const createEmployeeFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "At least 8 characters").optional().or(z.literal("")),
  employeeNo: z.string().optional().or(z.literal("")),
  joinDate: z.string().min(1, "Join date is required"),
  departmentId: z.string().uuid("Select a department"),
  positionId: z.string().uuid("Select a position"),
  workModel: z.enum(["OFFICE", "HYBRID", "REMOTE"]),
});

type CreateEmployeeForm = z.infer<typeof createEmployeeFormSchema>;

export function EmployeeCreatePage() {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateEmployeeForm>({
    resolver: zodResolver(createEmployeeFormSchema),
    defaultValues: { workModel: "OFFICE" },
  });
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

  const createMutation = useMutation({
    mutationFn: (input: CreateEmployeeForm) =>
      createEmployee({
        ...input,
        password: input.password || undefined,
        employeeNo: input.employeeNo || undefined,
      }),
  });

  const created = createMutation.data;

  if (created) {
    return <CreatedConfirmation employee={created} />;
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">New employee</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Creates the login account and employee record together, starting in DRAFT status.
      </p>

      <form
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        className="mt-6 space-y-4"
      >
        <TextField label="Email" type="email" registration={register("email")} error={errors.email?.message} />
        <TextField
          label="Password (optional — a temporary one is generated if left blank)"
          type="password"
          registration={register("password")}
          error={errors.password?.message}
        />
        <TextField
          label="Employee number (optional — auto-generated if left blank)"
          registration={register("employeeNo")}
          error={errors.employeeNo?.message}
        />
        <TextField
          label="Join date"
          type="date"
          registration={register("joinDate")}
          error={errors.joinDate?.message}
        />
        <SelectField
          label="Department"
          registration={register("departmentId")}
          placeholder="Select a department"
          options={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
          error={errors.departmentId?.message}
        />
        <SelectField
          label="Position"
          registration={register("positionId")}
          placeholder={departmentId ? "Select a position" : "Select a department first"}
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

        {createMutation.isError && (
          <p className="text-sm text-rose-600 dark:text-rose-400">
            {getApiErrorMessage(createMutation.error, "Could not create the employee.")}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-md bg-indigo-600 transition-colors hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            {createMutation.isPending ? "Creating…" : "Create employee"}
          </button>
          <Link to="/employees" className="text-sm text-slate-500 hover:underline dark:text-slate-400">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function CreatedConfirmation({ employee }: { employee: CreateEmployeeResult }) {
  const navigate = useNavigate();

  return (
    <div className="max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Employee {employee.employeeNo} created
      </h1>
      {employee.temporaryPassword && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/30">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Temporary password — shown once, save it now:
          </p>
          <p className="mt-1 font-mono text-amber-900 dark:text-amber-100">
            {employee.temporaryPassword}
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => navigate(`/employees/${employee.id}`)}
        className="mt-4 rounded-md bg-indigo-600 transition-colors hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white dark:bg-indigo-500 dark:hover:bg-indigo-400"
      >
        Go to employee
      </button>
    </div>
  );
}
