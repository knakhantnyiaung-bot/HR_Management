import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import {
  cancelExpenseClaim,
  downloadExpenseReceipt,
  listExpenseClaims,
  submitExpenseClaim,
  uploadExpenseReceipt,
} from "@/features/expenses/api";
import { ExpenseClaimForm } from "@/features/expenses/ExpenseClaimForm";
import type { ExpenseClaim } from "@/features/expenses/types";

export function MyExpenses({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["expenses", "claims", "mine", employeeId],
    queryFn: () => listExpenseClaims({ page: 1, pageSize: 50, employeeId }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["expenses", "claims"] });
  }

  const submitMutation = useMutation({ mutationFn: submitExpenseClaim, onSuccess: invalidate });
  const cancelMutation = useMutation({ mutationFn: cancelExpenseClaim, onSuccess: invalidate });
  const uploadMutation = useMutation({
    mutationFn: ({ claimId, file }: { claimId: string; file: File }) =>
      uploadExpenseReceipt(claimId, file),
    onSuccess: invalidate,
  });

  const actionError =
    submitMutation.error ?? cancelMutation.error ?? uploadMutation.error;

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">My expenses</h2>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
            New claim
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-2">
          <ExpenseClaimForm onDone={() => setShowForm(false)} />
        </div>
      )}

      {isLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-2 error-text">{getApiErrorMessage(error, "Could not load your claims.")}</p>
      )}
      {actionError && (
        <p className="mt-2 error-text">{getApiErrorMessage(actionError, "That action failed.")}</p>
      )}

      {data && (
        <div className="mt-2 overflow-x-auto card-table">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="table-head-cell">Category</th>
                <th className="table-head-cell">Date</th>
                <th className="table-head-cell">Amount</th>
                <th className="table-head-cell">Receipts</th>
                <th className="table-head-cell">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    No expense claims yet.
                  </td>
                </tr>
              )}
              {data.items.map((claim) => (
                <ClaimRow
                  key={claim.id}
                  claim={claim}
                  onSubmit={() => submitMutation.mutate(claim.id)}
                  onCancel={() => cancelMutation.mutate(claim.id)}
                  onUpload={(file) => uploadMutation.mutate({ claimId: claim.id, file })}
                  isBusy={
                    submitMutation.isPending || cancelMutation.isPending || uploadMutation.isPending
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ClaimRow({
  claim,
  onSubmit,
  onCancel,
  onUpload,
  isBusy,
}: {
  claim: ExpenseClaim;
  onSubmit: () => void;
  onCancel: () => void;
  onUpload: (file: File) => void;
  isBusy: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <tr className="row-hover">
      <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{claim.category.name}</td>
      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatDate(claim.expenseDate)}</td>
      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{claim.amount}</td>
      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
        <div className="flex flex-wrap gap-2">
          {claim.receipts.map((receipt) => (
            <button
              key={receipt.id}
              type="button"
              onClick={() => downloadExpenseReceipt(claim.id, receipt.id, receipt.fileName)}
              className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {receipt.fileName}
            </button>
          ))}
          {claim.status === "DRAFT" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="text-xs text-slate-500 hover:underline dark:text-slate-400"
              >
                + Add receipt
              </button>
            </>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={claim.status} />
        {claim.rejectionReason && (
          <p className="mt-1 text-xs text-danger-600 dark:text-danger-400">{claim.rejectionReason}</p>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-3">
          {claim.status === "DRAFT" && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isBusy}
              className="text-sm font-medium text-success-700 hover:underline disabled:opacity-50 dark:text-success-400"
            >
              Submit
            </button>
          )}
          {(claim.status === "DRAFT" || claim.status === "SUBMITTED") && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isBusy}
              className="btn-text hover:underline"
            >
              Cancel
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
