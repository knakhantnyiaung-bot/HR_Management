import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TextField } from "@/components/form/TextField";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  createGeofenceZone,
  deactivateGeofenceZone,
  getGeofencePolicy,
  listGeofenceZones,
  updateGeofencePolicy,
} from "@/features/geofence/api";
import type { LocationPolicy } from "@/features/geofence/types";

const POLICY_OPTIONS: Array<{ value: LocationPolicy; label: string }> = [
  { value: "NONE", label: "None — never capture location" },
  { value: "LOG_ONLY", label: "Log only — capture for visibility, never blocks check-in" },
  { value: "GEOFENCE_ENFORCED", label: "Geofence enforced — office employees must check in inside a zone" },
];

const zoneSchema = z.object({
  label: z.string().min(1, "Required"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().int().positive("Must be a positive number"),
});

type ZoneForm = z.infer<typeof zoneSchema>;

export function GeofenceSettingsSection() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: policy, isLoading: policyLoading } = useQuery({
    queryKey: ["geofence", "policy"],
    queryFn: getGeofencePolicy,
  });
  const { data: zones, isLoading: zonesLoading, isError, error } = useQuery({
    queryKey: ["geofence", "zones"],
    queryFn: listGeofenceZones,
  });

  const policyMutation = useMutation({
    mutationFn: updateGeofencePolicy,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["geofence", "policy"] }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ZoneForm>({ resolver: zodResolver(zoneSchema) });

  const createMutation = useMutation({
    mutationFn: createGeofenceZone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geofence", "zones"] });
      reset();
      setShowForm(false);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateGeofenceZone,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["geofence", "zones"] }),
  });

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Geofence policy
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Controls whether office-model employees must check in from inside a configured zone.
          Hybrid and remote employees are never affected, regardless of this setting.
        </p>

        {policyLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
        {policy && (
          <select
            value={policy.locationPolicy}
            onChange={(e) => policyMutation.mutate(e.target.value as LocationPolicy)}
            disabled={policyMutation.isPending}
            className="input-field mt-2"
          >
            {POLICY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
        {policyMutation.isError && (
          <p className="mt-2 error-text">
            {getApiErrorMessage(policyMutation.error, "Could not update the geofence policy.")}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Geofence zones
          </h2>
          {!showForm && (
            <button type="button" onClick={() => setShowForm(true)} className="btn-text">
              New zone
            </button>
          )}
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit((values) => createMutation.mutate(values))}
            className="mt-2 space-y-4 card"
          >
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Label" registration={register("label")} error={errors.label?.message} />
              <TextField
                label="Radius (meters)"
                type="number"
                registration={register("radiusMeters")}
                error={errors.radiusMeters?.message}
              />
              <TextField
                label="Latitude"
                type="number"
                registration={register("lat")}
                error={errors.lat?.message}
              />
              <TextField
                label="Longitude"
                type="number"
                registration={register("lng")}
                error={errors.lng?.message}
              />
            </div>
            {createMutation.isError && (
              <p className="error-text">
                {getApiErrorMessage(createMutation.error, "Could not create the zone.")}
              </p>
            )}
            <div className="flex items-center gap-3">
              <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? "Adding…" : "Add zone"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-text">
                Cancel
              </button>
            </div>
          </form>
        )}

        {zonesLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
        {isError && (
          <p className="mt-2 error-text">{getApiErrorMessage(error, "Could not load zones.")}</p>
        )}

        {zones && (
          <div className="mt-2 overflow-hidden card-table">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="table-head-cell">Label</th>
                  <th className="table-head-cell">Center</th>
                  <th className="table-head-cell">Radius</th>
                  <th className="table-head-cell">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {zones.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                      No zones configured yet.
                    </td>
                  </tr>
                )}
                {zones.map((zone) => (
                  <tr key={zone.id} className="row-hover">
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{zone.label}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {zone.lat.toFixed(5)}, {zone.lng.toFixed(5)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {zone.radiusMeters} m
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{zone.status}</td>
                    <td className="px-4 py-3 text-right">
                      {zone.status === "ACTIVE" && (
                        <button
                          type="button"
                          onClick={() => deactivateMutation.mutate(zone.id)}
                          disabled={deactivateMutation.isPending}
                          className="btn-text hover:underline"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
