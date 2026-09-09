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
            className="btn-text"
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
          className="mt-2 flex items-end gap-3 card"
        >
          <div className="flex-1">
            <label className="label-field">
              Name
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input-field-inset w-full"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending || !newName.trim()}
            className="btn-primary"
          >
            {createMutation.isPending ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="btn-text pb-2"
          >
            Cancel
          </button>
        </form>
      )}
      {createMutation.isError && (
        <p className="mt-2 error-text">
          {getApiErrorMessage(createMutation.error, "Could not create the department.")}
        </p>
      )}

      <div className="mt-4">
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="input-field"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </div>

      {isLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-2 error-text">
          {getApiErrorMessage(error, "Could not load departments.")}
        </p>
      )}
      {updateMutation.isError && (
        <p className="mt-2 error-text">
          {getApiErrorMessage(updateMutation.error, "Could not save that change.")}
        </p>
      )}

      {data && (
        <div className="mt-2 overflow-hidden card-table">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="table-head-cell">
                  Name
                </th>
                <th className="table-head-cell">
                  Status
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
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
        <td className="px-4 py-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field-inset w-full px-2 py-1"
          />
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={department.status} />
        </td>
        <td className="px-4 py-3 text-right">
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
              className="btn-text"
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
      <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{department.name}</td>
      <td className="px-4 py-3">
        <StatusBadge status={department.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onStartEdit}
            className="btn-text"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={onToggleStatus}
            disabled={isSaving}
            className="btn-text hover:underline"
          >
            {department.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </button>
        </div>
      </td>
    </tr>
  );
}
