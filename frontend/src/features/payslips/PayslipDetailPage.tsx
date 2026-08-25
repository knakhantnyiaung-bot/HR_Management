import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDate, formatMoney } from "@/lib/format";
import { getPayslip } from "@/features/payslips/api";

function LineItem({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <span className="text-slate-900 dark:text-slate-100">{formatMoney(amount)}</span>
    </div>
  );
}

export function PayslipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const payslipId = id!;

  const { data: payslip, isLoading, isError, error } = useQuery({
    queryKey: ["payslips", payslipId],
    queryFn: () => getPayslip(payslipId),
  });

  if (isLoading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
  }
  if (isError || !payslip) {
    return (
      <p className="text-sm text-rose-600 dark:text-rose-400">
        {getApiErrorMessage(error, "Could not load this payslip.")}
      </p>
    );
  }

  const { payrollItem } = payslip;
  const snapshot = payrollItem.snapshotInput;

  return (
    <div className="max-w-xl">
      <Link to="/payslips" className="text-sm text-slate-500 hover:underline dark:text-slate-400">
        ← Payslips
      </Link>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Payslip — {payrollItem.payrollRun.period}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {payrollItem.employee.employeeNo} · {payrollItem.employee.user.email}
            </p>
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Released {formatDate(payslip.releasedAt)}
          </p>
        </div>

        <div className="mt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Earnings
          </h2>
          <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
            <LineItem label="Basic salary" amount={snapshot.basicSalary} />
            {Object.entries(snapshot.allowances).map(([label, amount]) => (
              <LineItem key={label} label={label} amount={amount} />
            ))}
            {snapshot.approvedOvertimePay > 0 && (
              <LineItem label="Approved overtime" amount={snapshot.approvedOvertimePay} />
            )}
            {snapshot.bonus > 0 && <LineItem label="Bonus" amount={snapshot.bonus} />}
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-1.5 text-sm font-medium dark:border-slate-700">
            <span className="text-slate-900 dark:text-slate-100">Gross pay</span>
            <span className="text-slate-900 dark:text-slate-100">
              {formatMoney(Number(payrollItem.gross))}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Deductions
          </h2>
          <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
            {Object.entries(snapshot.deductions).map(([label, amount]) => (
              <LineItem key={label} label={label} amount={amount} />
            ))}
            {snapshot.unpaidLeaveDeduction > 0 && (
              <LineItem
                label={`Unpaid leave (${snapshot.unpaidLeaveDays}d)`}
                amount={snapshot.unpaidLeaveDeduction}
              />
            )}
            {snapshot.otherDeductions > 0 && (
              <LineItem label="Other deductions" amount={snapshot.otherDeductions} />
            )}
            {Object.keys(snapshot.deductions).length === 0 &&
              snapshot.unpaidLeaveDeduction === 0 &&
              snapshot.otherDeductions === 0 && (
                <p className="py-1.5 text-sm text-slate-400 dark:text-slate-500">None</p>
              )}
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-1.5 text-sm font-medium dark:border-slate-700">
            <span className="text-slate-900 dark:text-slate-100">Total deductions</span>
            <span className="text-slate-900 dark:text-slate-100">
              {formatMoney(Number(payrollItem.deductions))}
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-md bg-slate-50 px-4 py-3 dark:bg-slate-800">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Net pay</span>
          <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {formatMoney(Number(payrollItem.net))}
          </span>
        </div>
      </div>
    </div>
  );
}
