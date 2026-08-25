import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  createPosition,
  fetchDepartments,
  listPositions,
  updatePosition,
} from "@/features/organization/api";
import type { OrgStructureStatus, Position } from "@/features/organization/types";

const PAGE_SIZE = 20;

export function PositionsAdmin() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [status, setStatus] = useState<OrgStructureStatus | "">("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["departments", "ACTIVE"],
    queryFn: () => fetchDepartments("ACTIVE"),
  });
  const departmentNameById = new Map((departments ?? []).map((d) => [d.id, d.name]));

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["positions", "admin", { page, departmentFilter, status }],
    queryFn: () =>
      listPositions({
        page,
        pageSize: PAGE_SIZE,
        departmentId: departmentFilter || undefined,
        status: status || undefined,
      }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["positions"] });
  }

  const createMutation = useMutation({
    mutationFn: () => createPosition(newTitle, newDepartmentId),
    onSuccess: () => {
      invalidate();
      setNewTitle("");
      setNewDepartmentId("");
      setShowCreateForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updatePosition>[1] }) =>
      updatePosition(id, input),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  function handleFilterChange(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Positions</h2>
        {!showCreateForm && (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="text-sm text-slate-500 hover:underline dark:text-slate-400"
          >
            New position
          </button>
        )}
      </div>

      {showCreateForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="mt-2 flex items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Title
            </label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Department
            </label>
            <select
              value={newDepartmentId}
              onChange={(e) => setNewDepartmentId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">Select a department</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending || !newTitle.trim() || !newDepartmentId}
            className="rounded-md bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            {createMutation.isPending ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="pb-2 text-sm text-slate-500 hover:underline dark:text-slate-400"
          >
            Cancel
          </button>
        </form>
      )}
      {createMutation.isError && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(createMutation.error, "Could not create the position.")}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <select
          value={departmentFilter}
          onChange={(e) => handleFilterChange(setDepartmentFilter, e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">All departments</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => handleFilterChange(setStatus as (v: string) => void, e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </div>

      {isLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(error, "Could not load positions.")}
        </p>
      )}
      {updateMutation.isError && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(updateMutation.error, "Could not save that change.")}
        </p>
      )}

      {data && (
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                  Title
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                  Department
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                  Status
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    No positions match these filters.
                  </td>
                </tr>
              )}
              {data.items.map((position) => (
                <PositionRow
                  key={position.id}
                  position={position}
                  departmentOptions={departments ?? []}
                  departmentName={departmentNameById.get(position.departmentId) ?? "—"}
                  isEditing={editingId === position.id}
                  onStartEdit={() => setEditingId(position.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={(input) => updateMutation.mutate({ id: position.id, input })}
                  onToggleStatus={() =>
                    updateMutation.mutate({
                      id: position.id,
                      input: { status: position.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
                    })
                  }
                  isSaving={updateMutation.isPending}
                />
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
    </section>
  );
}

function PositionRow({
  position,
  departmentOptions,
  departmentName,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onToggleStatus,
  isSaving,
}: {
  position: Position;
  departmentOptions: Array<{ id: string; name: string }>;
  departmentName: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (input: { title: string; departmentId: string }) => void;
  onToggleStatus: () => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(position.title);
  const [departmentId, setDepartmentId] = useState(position.departmentId);

  if (isEditing) {
    return (
      <tr>
        <td className="px-4 py-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </td>
        <td className="px-4 py-2">
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {departmentOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-2">
          <StatusBadge status={position.status} />
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => onSave({ title, departmentId })}
              disabled={isSaving || !title.trim()}
              className="text-sm text-slate-900 hover:underline disabled:opacity-50 dark:text-slate-100"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-sm text-slate-500 hover:underline dark:text-slate-400"
            >
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-4 py-2 text-slate-900 dark:text-slate-100">{position.title}</td>
      <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{departmentName}</td>
      <td className="px-4 py-2">
        <StatusBadge status={position.status} />
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onStartEdit}
            className="text-sm text-slate-500 hover:underline dark:text-slate-400"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onToggleStatus}
            disabled={isSaving}
            className="text-sm text-slate-500 hover:underline disabled:opacity-50 dark:text-slate-400"
          >
            {position.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </button>
        </div>
      </td>
    </tr>
  );
}
