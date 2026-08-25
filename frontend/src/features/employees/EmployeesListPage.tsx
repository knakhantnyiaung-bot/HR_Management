import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import { listEmployees } from "@/features/employees/api";
import type { EmployeeStatus } from "@/features/employees/types";
import { fetchDepartments } from "@/features/organization/api";

const PAGE_SIZE = 20;
const STATUS_OPTIONS: EmployeeStatus[] = ["DRAFT", "ACTIVE", "INACTIVE", "TERMINATED"];

export function EmployeesListPage() {
  const [page, setPage] = useState(1);
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState<EmployeeStatus | "">("");

  const { data: departments } = useQuery({
    queryKey: ["departments", "ACTIVE"],
    queryFn: () => fetchDepartments("ACTIVE"),
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["employees", { page, departmentId, status }],
    queryFn: () =>
      listEmployees({
        page,
        pageSize: PAGE_SIZE,
        departmentId: departmentId || undefined,
        status: status || undefined,
      }),
  });

  function handleFilterChange(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Employees</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Roster, lifecycle, and compensation.
          </p>
        </div>
        <Link
          to="/employees/new"
          className="rounded-md bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-sm font-medium text-white dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          New employee
        </Link>
      </div>

      <div className="mt-6 flex gap-3">
        <select
          value={departmentId}
          onChange={(e) => handleFilterChange(setDepartmentId, e.target.value)}
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
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-6 text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(error, "Could not load employees.")}
        </p>
      )}

      {data && (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                  Employee no.
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                  Email
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                  Department
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                  Position
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {data.items.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-400 dark:text-slate-500"
                  >
                    No employees match these filters.
                  </td>
                </tr>
              )}
              {data.items.map((employee) => (
                <tr key={employee.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2">
                    <Link
                      to={`/employees/${employee.id}`}
                      className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {employee.employeeNo}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                    {employee.user.email}
                  </td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                    {employee.department.name}
                  </td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                    {employee.position.title}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={employee.status} />
                  </td>
                </tr>
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
    </div>
  );
}
