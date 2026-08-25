import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  createDepartment,
  listDepartments,
  updateDepartment,
} from "@/features/organization/api";
import type { Department, OrgStructureStatus } from "@/features/organization/types";

const PAGE_SIZE = 20;

export function DepartmentsAdmin() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrgStructureStatus | "">("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["departments", "admin", { page, status }],
    queryFn: () => listDepartments({ page, pageSize: PAGE_SIZE, status: status || undefined }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["departments"] });
  }

  const createMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      invalidate();
      setNewName("");
      setShowCreateForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateDepartment>[1] }) =>
      updateDepartment(id, input),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  function handleStatusChange(value: string) {
    setStatus(value as OrgStructureStatus | "");
    setPage(1);
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Departments</h2>
        {!showCreateForm && (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="text-sm text-slate-500 hover:underline dark:text-slate-400"
          >
            New department
          </button>
        )}
      </div>

      {showCreateForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(newName);
          }}
          className="mt-2 flex items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Name
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending || !newName.trim()}
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
          {getApiErrorMessage(createMutation.error, "Could not create the department.")}
        </p>
      )}

      <div className="mt-4">
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
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
          {getApiErrorMessage(error, "Could not load departments.")}
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
                  Name
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
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    No departments match this filter.
                  </td>
                </tr>
              )}
              {data.items.map((department) => (
                <DepartmentRow
                  key={department.id}
                  department={department}
                  isEditing={editingId === department.id}
                  onStartEdit={() => setEditingId(department.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveName={(name) => updateMutation.mutate({ id: department.id, input: { name } })}
                  onToggleStatus={() =>
                    updateMutation.mutate({
                      id: department.id,
                      input: { status: department.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
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

function DepartmentRow({
  department,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveName,
  onToggleStatus,
  isSaving,
}: {
  department: Department;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveName: (name: string) => void;
  onToggleStatus: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(department.name);

  if (isEditing) {
    return (
      <tr>
        <td className="px-4 py-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </td>
        <td className="px-4 py-2">
          <StatusBadge status={department.status} />
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => onSaveName(name)}
              disabled={isSaving || !name.trim()}
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
      <td className="px-4 py-2 text-slate-900 dark:text-slate-100">{department.name}</td>
      <td className="px-4 py-2">
        <StatusBadge status={department.status} />
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onStartEdit}
            className="text-sm text-slate-500 hover:underline dark:text-slate-400"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={onToggleStatus}
            disabled={isSaving}
            className="text-sm text-slate-500 hover:underline disabled:opacity-50 dark:text-slate-400"
          >
            {department.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </button>
        </div>
      </td>
    </tr>
  );
}
