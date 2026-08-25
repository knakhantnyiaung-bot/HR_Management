import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TextField } from "@/components/form/TextField";
import { getApiErrorMessage } from "@/lib/api/client";
import { useAuth } from "@/features/auth/AuthContext";
import { getOrganization, updateOrganization } from "@/features/organization/api";

const orgSchema = z.object({
  name: z.string().min(1, "Required"),
  timezone: z.string().min(1, "Required"),
  currency: z.string().min(1, "Required"),
  payrollCycle: z.string().min(1, "Required"),
});

type OrgForm = z.infer<typeof orgSchema>;

export function OrganizationSettingsSection() {
  const { user } = useAuth();
  const canEdit = user?.role === "SUPER_ADMIN";
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: organization, isLoading, isError, error } = useQuery({
    queryKey: ["organization"],
    queryFn: getOrganization,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrgForm>({ resolver: zodResolver(orgSchema) });

  const updateMutation = useMutation({
    mutationFn: updateOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      setIsEditing(false);
    },
  });

  function startEditing() {
    if (!organization) return;
    reset({
      name: organization.name,
      timezone: organization.timezone,
      currency: organization.currency,
      payrollCycle: organization.payrollCycle,
    });
    setIsEditing(true);
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Organization</h2>
        {canEdit && !isEditing && organization && (
          <button
            type="button"
            onClick={startEditing}
            className="text-sm text-slate-500 hover:underline dark:text-slate-400"
          >
            Edit
          </button>
        )}
      </div>

      {isLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(error, "Could not load organization settings.")}
        </p>
      )}

      {organization && !isEditing && (
        <dl className="mt-2 grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Field label="Name" value={organization.name} />
          <Field label="Timezone" value={organization.timezone} />
          <Field label="Currency" value={organization.currency} />
          <Field label="Payroll cycle" value={organization.payrollCycle} />
        </dl>
      )}

      {isEditing && (
        <form
          onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
          className="mt-2 space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Name" registration={register("name")} error={errors.name?.message} />
            <TextField
              label="Timezone"
              registration={register("timezone")}
              error={errors.timezone?.message}
            />
            <TextField
              label="Currency"
              registration={register("currency")}
              error={errors.currency?.message}
            />
            <TextField
              label="Payroll cycle"
              registration={register("payrollCycle")}
              error={errors.payrollCycle?.message}
            />
          </div>

          {updateMutation.isError && (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {getApiErrorMessage(updateMutation.error, "Could not save organization settings.")}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-md bg-indigo-600 transition-colors hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              {updateMutation.isPending ? "Saving…" : "Save"}
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
    </section>
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
