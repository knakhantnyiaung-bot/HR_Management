import { useEffect, useState } from "react";
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

const careersSchema = z.object({
  careersSlug: z
    .string()
    .regex(/^[a-z0-9-]*$/, "Lowercase letters, numbers, and hyphens only")
    .refine((v) => v === "" || v.length >= 3, "Must be at least 3 characters"),
  careersEnabled: z.boolean(),
});

type CareersForm = z.infer<typeof careersSchema>;

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

  const {
    register: registerCareers,
    handleSubmit: handleCareersSubmit,
    reset: resetCareers,
    formState: { errors: careersErrors },
  } = useForm<CareersForm>({ resolver: zodResolver(careersSchema) });

  const careersMutation = useMutation({
    mutationFn: (values: CareersForm) =>
      updateOrganization({ careersSlug: values.careersSlug || null, careersEnabled: values.careersEnabled }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["organization"], updated);
      resetCareers({ careersSlug: updated.careersSlug ?? "", careersEnabled: updated.careersEnabled });
    },
  });

  useEffect(() => {
    if (organization) {
      resetCareers({ careersSlug: organization.careersSlug ?? "", careersEnabled: organization.careersEnabled });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Organization</h2>
        {canEdit && !isEditing && organization && (
          <button
            type="button"
            onClick={startEditing}
            className="btn-text"
          >
            Edit
          </button>
        )}
      </div>

      {isLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-2 error-text">
          {getApiErrorMessage(error, "Could not load organization settings.")}
        </p>
      )}

      {organization && !isEditing && (
        <dl className="mt-2 grid grid-cols-2 gap-4 card text-sm">
          <Field label="Name" value={organization.name} />
          <Field label="Timezone" value={organization.timezone} />
          <Field label="Currency" value={organization.currency} />
          <Field label="Payroll cycle" value={organization.payrollCycle} />
        </dl>
      )}

      {isEditing && (
        <form
          onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
          className="mt-2 space-y-4 card"
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
            <p className="error-text">
              {getApiErrorMessage(updateMutation.error, "Could not save organization settings.")}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-primary"
            >
              {updateMutation.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn-text"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {canEdit && organization && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Careers page</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Publish a public job-listing page candidates can browse and apply from. No slug means no
            public page at all — this is opt-in.
          </p>

          <form
            onSubmit={handleCareersSubmit((values) => careersMutation.mutate(values))}
            className="mt-2 space-y-4 card"
          >
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Careers page URL slug"
                placeholder="acme-corp"
                registration={registerCareers("careersSlug")}
                error={careersErrors.careersSlug?.message}
              />
              <div>
                <span className="label-field">Public page</span>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    {...registerCareers("careersEnabled")}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700"
                  />
                  Enabled
                </label>
              </div>
            </div>

            {organization.careersSlug && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Public URL: <span className="font-mono">/careers/{organization.careersSlug}</span>
              </p>
            )}

            {careersMutation.isError && (
              <p className="error-text">
                {getApiErrorMessage(careersMutation.error, "Could not save careers page settings.")}
              </p>
            )}

            <button type="submit" disabled={careersMutation.isPending} className="btn-primary">
              {careersMutation.isPending ? "Saving…" : "Save"}
            </button>
          </form>
        </div>
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
