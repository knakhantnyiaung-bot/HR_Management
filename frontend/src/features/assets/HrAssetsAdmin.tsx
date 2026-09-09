import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TextField } from "@/components/form/TextField";
import { SelectField } from "@/components/form/SelectField";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import { listEmployees } from "@/features/employees/api";
import { assignAsset, createAsset, listAssets, returnAsset, updateAsset } from "@/features/assets/api";
import type { AssetCategory, AssetStatus } from "@/features/assets/types";

const CATEGORIES: AssetCategory[] = ["LAPTOP", "MONITOR", "PHONE", "PERIPHERAL", "FURNITURE", "OTHER"];
const STATUSES: AssetStatus[] = ["AVAILABLE", "ASSIGNED", "IN_REPAIR", "RETIRED"];

const assetSchema = z.object({
  assetTag: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  category: z.enum(["LAPTOP", "MONITOR", "PHONE", "PERIPHERAL", "FURNITURE", "OTHER"]),
  serialNumber: z.string().optional(),
});
type AssetForm = z.infer<typeof assetSchema>;

export function HrAssetsAdmin() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "">("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["assets", "all", statusFilter],
    queryFn: () => listAssets({ page: 1, pageSize: 100, status: statusFilter || undefined }),
  });

  const { data: employees } = useQuery({
    queryKey: ["employees", "for-asset-assignment"],
    queryFn: () => listEmployees({ page: 1, pageSize: 100, status: "ACTIVE" }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["assets"] });
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssetForm>({ resolver: zodResolver(assetSchema), defaultValues: { category: "OTHER" } });

  const createMutation = useMutation({
    mutationFn: createAsset,
    onSuccess: () => {
      invalidate();
      reset();
      setShowForm(false);
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, employeeId }: { id: string; employeeId: string }) => assignAsset(id, employeeId),
    onSuccess: () => {
      invalidate();
      setAssigningId(null);
      setAssignEmployeeId("");
    },
  });

  const returnMutation = useMutation({ mutationFn: (id: string) => returnAsset(id), onSuccess: invalidate });

  const retireMutation = useMutation({
    mutationFn: (id: string) => updateAsset(id, { status: "RETIRED" }),
    onSuccess: invalidate,
  });

  const actionError =
    assignMutation.error ?? returnMutation.error ?? retireMutation.error ?? createMutation.error;

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Asset register</h2>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
            New asset
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          className="mt-2 space-y-4 card"
        >
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Asset tag" registration={register("assetTag")} error={errors.assetTag?.message} />
            <TextField label="Name" registration={register("name")} error={errors.name?.message} />
            <SelectField
              label="Category"
              registration={register("category")}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              error={errors.category?.message}
            />
            <TextField
              label="Serial number (optional)"
              registration={register("serialNumber")}
              error={errors.serialNumber?.message}
            />
          </div>
          {createMutation.isError && (
            <p className="error-text">{getApiErrorMessage(createMutation.error, "Could not create the asset.")}</p>
          )}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? "Adding…" : "Add asset"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-text">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AssetStatus | "")}
          className="input-field"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && <p className="mt-4 error-text">{getApiErrorMessage(error, "Could not load assets.")}</p>}
      {actionError && <p className="mt-4 error-text">{getApiErrorMessage(actionError, "That action failed.")}</p>}

      {data && (
        <div className="mt-4 overflow-hidden card-table">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="table-head-cell">Tag</th>
                <th className="table-head-cell">Name</th>
                <th className="table-head-cell">Category</th>
                <th className="table-head-cell">Status</th>
                <th className="table-head-cell">Assigned to</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    No assets match these filters.
                  </td>
                </tr>
              )}
              {data.items.map((asset) => (
                <tr key={asset.id} className="row-hover">
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{asset.assetTag}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{asset.name}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{asset.category}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={asset.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {asset.currentEmployee ? asset.currentEmployee.employeeNo : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {asset.status === "AVAILABLE" && assigningId !== asset.id && (
                      <button type="button" onClick={() => setAssigningId(asset.id)} className="btn-text">
                        Assign
                      </button>
                    )}
                    {asset.status === "AVAILABLE" && assigningId === asset.id && (
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={assignEmployeeId}
                          onChange={(e) => setAssignEmployeeId(e.target.value)}
                          className="input-field"
                        >
                          <option value="">Select employee…</option>
                          {employees?.items.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.employeeNo} — {emp.user.email}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!assignEmployeeId || assignMutation.isPending}
                          onClick={() => assignMutation.mutate({ id: asset.id, employeeId: assignEmployeeId })}
                          className="btn-text"
                        >
                          Confirm
                        </button>
                        <button type="button" onClick={() => setAssigningId(null)} className="btn-text">
                          Cancel
                        </button>
                      </div>
                    )}
                    {asset.status === "ASSIGNED" && (
                      <button
                        type="button"
                        onClick={() => returnMutation.mutate(asset.id)}
                        disabled={returnMutation.isPending}
                        className="btn-text"
                      >
                        Return
                      </button>
                    )}
                    {(asset.status === "AVAILABLE" || asset.status === "IN_REPAIR") && (
                      <button
                        type="button"
                        onClick={() => retireMutation.mutate(asset.id)}
                        disabled={retireMutation.isPending}
                        className="btn-text text-danger-600 hover:underline dark:text-danger-400"
                      >
                        Retire
                      </button>
                    )}
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
