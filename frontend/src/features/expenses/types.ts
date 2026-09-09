export type ExpenseClaimStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "REIMBURSED"
  | "CANCELLED";

export interface ExpenseCategory {
  id: string;
  name: string;
  requiresReceipt: boolean;
  status: "ACTIVE" | "INACTIVE";
}

export interface ExpenseReceipt {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export type DisbursementMethod = "BANK_TRANSFER" | "CHEQUE" | "CASH" | "OTHER";

export interface ExpenseClaim {
  id: string;
  amount: string;
  expenseDate: string;
  description: string | null;
  status: ExpenseClaimStatus;
  rejectionReason: string | null;
  disbursementMethod: DisbursementMethod | null;
  disbursementReference: string | null;
  disbursedAt: string | null;
  createdAt: string;
  employee: { id: string; employeeNo: string; user: { email: string } };
  category: { id: string; name: string; requiresReceipt: boolean };
  receipts: ExpenseReceipt[];
}
