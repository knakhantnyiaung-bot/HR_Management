import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Pagination } from "@/components/Pagination";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDate, formatMoney } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthContext";
import { listPayslips } from "@/features/payslips/api";
import { listEmployees } from "@/features/employees/api";

const PAGE_SIZE = 20;
const HR_ROLES = new Set(["HR_ADMIN", "SUPER_ADMIN"]);

export function PayslipsListPage() {
  const { user } = useAuth();
  const isHrRole = Boolean(user && HR_ROLES.has(user.role));

  const [page, setPage] = useState(1);
  const [employeeId, setEmployeeId] = useState("");
  const [period, setPeriod] = useState("");

  const { data: employees } = useQuery({
    queryKey: ["employees", "picker"],
    queryFn: () => listEmployees({ page: 1, pageSize: 100 }),
    enabled: isHrRole,
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["payslips", { page, employeeId, period }],
    queryFn: () =>
      listPayslips({
        page,
        pageSize: PAGE_SIZE,
        employeeId: employeeId || undefined,
        period: period || undefined,
      }),
  });

  function handleFilterChange(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <div>
      <h1 className="page-title">Payslips</h1>
      <p className="page-subtitle">
        {isHrRole ? "Released salary statements across the organization." : "Your released payslips."}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {isHrRole && (
          <select
            value={employeeId}
            onChange={(e) => handleFilterChange(setEmployeeId, e.target.value)}
            className="input-field"
          >
            <option value="">All employees</option>
            {employees?.items.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employeeNo} · {e.user.email}
              </option>
            ))}
          </select>
        )}
        <input
          type="month"
          value={period}
          onChange={(e) => handleFilterChange(setPeriod, e.target.value)}
          className="input-field"
        />
      </div>

      {isLoading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-6 error-text">
          {getApiErrorMessage(error, "Could not load payslips.")}
        </p>
      )}

      {data && (
        <div className="mt-4 overflow-hidden card-table">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="table-head-cell">
                  Period
                </th>
                {isHrRole && (
                  <th className="table-head-cell">
                    Employee
                  </th>
                )}
                <th className="table-head-cell">
                  Released
                </th>
                <th className="table-head-cell text-right">
                  Gross
                </th>
                <th className="table-head-cell text-right">
                  Net
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {data.items.length === 0 && (
                <tr>
                  <td
                    colSpan={isHrRole ? 5 : 4}
                    className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500"
                  >
                    No payslips match these filters.
                  </td>
                </tr>
              )}
              {data.items.map((payslip) => (
                <tr key={payslip.id} className="row-hover">
                  <td className="px-4 py-3">
                    <Link
                      to={`/payslips/${payslip.id}`}
                      className="link-accent"
                    >
                      {payslip.payrollItem.payrollRun.period}
                    </Link>
                  </td>
                  {isHrRole && (
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {payslip.payrollItem.employee.employeeNo}
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {formatDate(payslip.releasedAt)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                    {formatMoney(Number(payslip.payrollItem.gross))}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">
                    {formatMoney(Number(payslip.payrollItem.net))}
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
