import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import {
  approveExpenseClaim,
  createExpenseCategory,
  downloadExpenseDisbursementCsv,
  listExpenseCategories,
  listExpenseClaims,
  reimburseExpenseClaim,
  rejectExpenseClaim,
} from "@/features/expenses/api";
import type { DisbursementMethod, ExpenseClaimStatus } from "@/features/expenses/types";

const PAGE_SIZE = 20;
const DISBURSEMENT_METHODS: DisbursementMethod[] = ["BANK_TRANSFER", "CHEQUE", "CASH", "OTHER"];
const STATUS_OPTIONS: ExpenseClaimStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "REIMBURSED",
  "CANCELLED",
];

export function HrExpenseApprovals() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ExpenseClaimStatus | "">("SUBMITTED");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [requiresReceipt, setRequiresReceipt] = useState(true);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["expenses", "claims", "all", { page, status }],
    queryFn: () => listExpenseClaims({ page, pageSize: PAGE_SIZE, status: status || undefined }),
  });

  const { data: categories } = useQuery({
    queryKey: ["expenses", "categories"],
    queryFn: listExpenseCategories,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["expenses", "claims"] });
  }

  const approveMutation = useMutation({ mutationFn: approveExpenseClaim, onSuccess: invalidate });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectExpenseClaim(id, reason),
    onSuccess: invalidate,
  });
  const reimburseMutation = useMutation({
    mutationFn: ({
      id,
      method,
      reference,
    }: {
      id: string;
      method: DisbursementMethod;
      reference: string;
    }) => reimburseExpenseClaim(id, method, reference),
    onSuccess: invalidate,
  });
  const createCategoryMutation = useMutation({
    mutationFn: createExpenseCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", "categories"] });
      setCategoryName("");
      setShowCategoryForm(false);
    },
  });

  function handleReject(id: string) {
    const reason = window.prompt("Reason for rejecting this claim:");
    if (reason && reason.trim()) {
      rejectMutation.mutate({ id, reason: reason.trim() });
    }
  }

  // EXP-09..11 — reimburse an APPROVED claim outside the payroll cycle.
  // Two sequential prompts, same lightweight pattern as handleReject above
  // rather than a dedicated modal.
  function handleReimburse(id: string) {
    const methodInput = window.prompt(
      `Disbursement method (${DISBURSEMENT_METHODS.join(" / ")}):`,
      "BANK_TRANSFER",
    );
    if (!methodInput) return;
    const method = methodInput.trim().toUpperCase() as DisbursementMethod;
    if (!DISBURSEMENT_METHODS.includes(method)) {
      window.alert(`Invalid method. Must be one of: ${DISBURSEMENT_METHODS.join(", ")}`);
      return;
    }

    const reference = window.prompt("Disbursement reference (e.g. bank transfer no., cheque no.):");
    if (reference && reference.trim()) {
      reimburseMutation.mutate({ id, method, reference: reference.trim() });
    }
  }

  const downloadDisbursementMutation = useMutation({ mutationFn: downloadExpenseDisbursementCsv });

  const actionError =
    approveMutation.error ??
    rejectMutation.error ??
    reimburseMutation.error ??
    downloadDisbursementMutation.error;

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Expense categories
          </h2>
          {!showCategoryForm && (
            <button type="button" onClick={() => setShowCategoryForm(true)} className="btn-text">
              New category
            </button>
          )}
        </div>

        {showCategoryForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createCategoryMutation.mutate({ name: categoryName, requiresReceipt });
            }}
            className="mt-2 flex flex-wrap items-end gap-3 card"
          >
            <div className="flex-1">
              <label className="label-field">Name</label>
              <input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="input-field-inset w-full"
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={requiresReceipt}
                onChange={(e) => setRequiresReceipt(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700"
              />
              Requires receipt
            </label>
            <button
              type="submit"
              disabled={createCategoryMutation.isPending || !categoryName.trim()}
              className="btn-primary"
            >
              {createCategoryMutation.isPending ? "Adding…" : "Add"}
            </button>
            <button type="button" onClick={() => setShowCategoryForm(false)} className="btn-text pb-2">
              Cancel
            </button>
          </form>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          {categories?.map((category) => (
            <span
              key={category.id}
              className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {category.name}
              {category.requiresReceipt && " (receipt required)"}
            </span>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            All expense claims
          </h2>
          <button
            type="button"
            onClick={() => downloadDisbursementMutation.mutate()}
            disabled={downloadDisbursementMutation.isPending}
            className="btn-text"
          >
            {downloadDisbursementMutation.isPending ? "Preparing…" : "Download disbursement file"}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          A bank-ready CSV of every APPROVED claim not yet paid via a payroll run.
        </p>

        <div className="mt-2 flex flex-wrap gap-3">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ExpenseClaimStatus | "");
              setPage(1);
            }}
            className="input-field"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {isLoading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
        {isError && (
          <p className="mt-4 error-text">{getApiErrorMessage(error, "Could not load claims.")}</p>
        )}
        {actionError && (
          <p className="mt-4 error-text">{getApiErrorMessage(actionError, "That action failed.")}</p>
        )}

        {data && (
          <div className="mt-4 overflow-hidden card-table">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="table-head-cell">Employee</th>
                  <th className="table-head-cell">Category</th>
                  <th className="table-head-cell">Date</th>
                  <th className="table-head-cell">Amount</th>
                  <th className="table-head-cell">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                      No claims match these filters.
                    </td>
                  </tr>
                )}
                {data.items.map((claim) => (
                  <tr key={claim.id} className="row-hover">
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                      {claim.employee.employeeNo}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{claim.category.name}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {formatDate(claim.expenseDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{claim.amount}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={claim.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {claim.status === "SUBMITTED" && (
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => approveMutation.mutate(claim.id)}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            className="text-sm font-medium text-success-700 hover:underline disabled:opacity-50 dark:text-success-400"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(claim.id)}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            className="text-sm text-danger-600 hover:underline disabled:opacity-50 dark:text-danger-400"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {claim.status === "APPROVED" && (
                        <button
                          type="button"
                          onClick={() => handleReimburse(claim.id)}
                          disabled={reimburseMutation.isPending}
                          className="text-sm font-medium text-success-700 hover:underline disabled:opacity-50 dark:text-success-400"
                        >
                          Mark reimbursed
                        </button>
                      )}
                      {claim.status === "REIMBURSED" && claim.disbursementReference && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {claim.disbursementMethod} · {claim.disbursementReference}
                        </span>
                      )}
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
      </section>
    </div>
  );
}
