import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { ListResult } from "@/lib/api/types";
import type {
  DisbursementMethod,
  ExpenseCategory,
  ExpenseClaim,
  ExpenseClaimStatus,
} from "@/features/expenses/types";

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const res = await apiClient.get<ApiSuccess<ExpenseCategory[]>>("/expenses/categories");
  return res.data.data;
}

export async function createExpenseCategory(input: {
  name: string;
  requiresReceipt: boolean;
}): Promise<ExpenseCategory> {
  const res = await apiClient.post<ApiSuccess<ExpenseCategory>>("/expenses/categories", input);
  return res.data.data;
}

export interface CreateExpenseClaimInput {
  categoryId: string;
  amount: number;
  expenseDate: string;
  description?: string;
}

export async function createExpenseClaim(input: CreateExpenseClaimInput): Promise<ExpenseClaim> {
  const res = await apiClient.post<ApiSuccess<ExpenseClaim>>("/expenses/claims", input);
  return res.data.data;
}

export interface ListExpenseClaimsParams {
  page: number;
  pageSize: number;
  employeeId?: string;
  status?: ExpenseClaimStatus;
}

export async function listExpenseClaims(
  params: ListExpenseClaimsParams,
): Promise<ListResult<ExpenseClaim>> {
  const res = await apiClient.get<ApiSuccess<ExpenseClaim[]>>("/expenses/claims", { params });
  return { items: res.data.data, meta: res.data.meta! };
}

export async function submitExpenseClaim(id: string): Promise<ExpenseClaim> {
  const res = await apiClient.post<ApiSuccess<ExpenseClaim>>(`/expenses/claims/${id}/submit`);
  return res.data.data;
}

export async function cancelExpenseClaim(id: string): Promise<ExpenseClaim> {
  const res = await apiClient.post<ApiSuccess<ExpenseClaim>>(`/expenses/claims/${id}/cancel`);
  return res.data.data;
}

export async function approveExpenseClaim(id: string): Promise<ExpenseClaim> {
  const res = await apiClient.post<ApiSuccess<ExpenseClaim>>(`/expenses/claims/${id}/approve`);
  return res.data.data;
}

export async function rejectExpenseClaim(id: string, reason: string): Promise<ExpenseClaim> {
  const res = await apiClient.post<ApiSuccess<ExpenseClaim>>(`/expenses/claims/${id}/reject`, {
    reason,
  });
  return res.data.data;
}

export async function reimburseExpenseClaim(
  id: string,
  disbursementMethod: DisbursementMethod,
  disbursementReference: string,
): Promise<ExpenseClaim> {
  const res = await apiClient.post<ApiSuccess<ExpenseClaim>>(`/expenses/claims/${id}/reimburse`, {
    disbursementMethod,
    disbursementReference,
  });
  return res.data.data;
}

export async function uploadExpenseReceipt(claimId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("files", file);
  await apiClient.post(`/expenses/claims/${claimId}/receipts`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

// The download route requires the same Bearer auth as every other API call
// (no query-string token support), so a plain <a href> can't authenticate —
// fetch as a blob and hand the browser a local object URL instead.
export async function downloadExpenseReceipt(
  claimId: string,
  receiptId: string,
  fileName: string,
): Promise<void> {
  const res = await apiClient.get(`/expenses/claims/${claimId}/receipts/${receiptId}/file`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
}

// BANK-01 — same blob-download approach.
export async function downloadExpenseDisbursementCsv(): Promise<void> {
  const res = await apiClient.get("/expenses/disbursement-file", { responseType: "blob" });
  const url = window.URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `expense-disbursement-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}
