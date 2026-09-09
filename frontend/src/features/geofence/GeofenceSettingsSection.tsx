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
import { GeofencePolygonMap } from "@/features/geofence/GeofencePolygonMap";
import type { GeofencePoint, GeofenceShape, LocationPolicy } from "@/features/geofence/types";

const POLICY_OPTIONS: Array<{ value: LocationPolicy; label: string }> = [
  { value: "NONE", label: "None — never capture location" },
  { value: "LOG_ONLY", label: "Log only — capture for visibility, never blocks check-in" },
  { value: "GEOFENCE_ENFORCED", label: "Geofence enforced — office employees must check in inside a zone" },
];

const MIN_POLYGON_POINTS = 3;

// GEO-10/13 — a single form schema for both shapes; which fields are
// actually required depends on `shape`, checked in .superRefine rather than
// via two separate schemas so the form stays one react-hook-form instance.
// Polygon vertices aren't part of this schema at all — they're plain
// component state (`polygonPoints`) driven by clicks on the map, not typed
// input, and are validated separately at submit time.
const zoneFormSchema = z
  .object({
    label: z.string().min(1, "Required"),
    shape: z.enum(["CIRCLE", "POLYGON"]),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusMeters: z.coerce.number().int().positive("Must be a positive number").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.shape !== "CIRCLE") return;
    if (data.lat === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required", path: ["lat"] });
    if (data.lng === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required", path: ["lng"] });
    if (data.radiusMeters === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required", path: ["radiusMeters"] });
    }
  });

type ZoneForm = z.infer<typeof zoneFormSchema>;

function zoneSummary(zone: { shape: GeofenceShape; lat: number | null; lng: number | null; radiusMeters: number | null; polygon: GeofencePoint[] | null }): string {
  if (zone.shape === "POLYGON") {
    return `Polygon — ${zone.polygon?.length ?? 0} points`;
  }
  return `${zone.lat?.toFixed(5)}, ${zone.lng?.toFixed(5)} — ${zone.radiusMeters} m`;
}

export function GeofenceSettingsSection() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState<GeofencePoint[]>([]);
  const [polygonError, setPolygonError] = useState<string | null>(null);

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
    watch,
    reset,
    formState: { errors },
  } = useForm<ZoneForm>({
    resolver: zodResolver(zoneFormSchema),
    defaultValues: { shape: "CIRCLE" },
    // Circle and polygon fields mount/unmount as `shape` toggles.
    // react-hook-form's default (shouldUnregister: false) keeps an
    // unmounted field's last value in form state — e.g. radiusMeters'
    // empty-string default would coerce to 0 and silently fail its
    // .positive() check on a POLYGON submit, even though that field isn't
    // rendered to show the error. Unregistering on unmount avoids that.
    shouldUnregister: true,
  });
  const shape = watch("shape");

  const createMutation = useMutation({
    mutationFn: createGeofenceZone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geofence", "zones"] });
      reset({ shape: "CIRCLE" });
      setPolygonPoints([]);
      setPolygonError(null);
      setShowForm(false);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateGeofenceZone,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["geofence", "zones"] }),
  });

  function onSubmit(values: ZoneForm) {
    if (values.shape === "CIRCLE") {
      createMutation.mutate({
        label: values.label,
        shape: "CIRCLE",
        lat: values.lat!,
        lng: values.lng!,
        radiusMeters: values.radiusMeters!,
      });
      return;
    }
    if (polygonPoints.length < MIN_POLYGON_POINTS) {
      setPolygonError(`At least ${MIN_POLYGON_POINTS} points are required`);
      return;
    }
    setPolygonError(null);
    createMutation.mutate({ label: values.label, shape: "POLYGON", polygon: polygonPoints });
  }

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
          <form onSubmit={handleSubmit(onSubmit)} className="mt-2 space-y-4 card">
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Label" registration={register("label")} error={errors.label?.message} />
              <div>
                <label className="label-field" htmlFor="shape">
                  Shape
                </label>
                <select id="shape" className="input-field-inset w-full" {...register("shape")}>
                  <option value="CIRCLE">Circle (center + radius)</option>
                  <option value="POLYGON">Polygon (draw on map)</option>
                </select>
              </div>
            </div>

            {shape === "CIRCLE" ? (
              <div className="grid grid-cols-3 gap-4">
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
            ) : (
              <div>
                <GeofencePolygonMap points={polygonPoints} onChange={setPolygonPoints} />
                {polygonError && <p className="field-error-text">{polygonError}</p>}
              </div>
            )}

            {createMutation.isError && (
              <p className="error-text">
                {getApiErrorMessage(createMutation.error, "Could not create the zone.")}
              </p>
            )}
            <div className="flex items-center gap-3">
              <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? "Adding…" : "Add zone"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setPolygonPoints([]);
                  setPolygonError(null);
                  reset({ shape: "CIRCLE" });
                }}
                className="btn-text"
              >
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
                  <th className="table-head-cell">Shape</th>
                  <th className="table-head-cell">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {zones.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                      No zones configured yet.
                    </td>
                  </tr>
                )}
                {zones.map((zone) => (
                  <tr key={zone.id} className="row-hover">
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{zone.label}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{zoneSummary(zone)}</td>
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
