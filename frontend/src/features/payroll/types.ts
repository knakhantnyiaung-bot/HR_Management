import type { PayrollRunStatus } from "@/types/payroll";

export interface PayrollTotals {
  employeeCount: number;
  grossTotal: number;
  netTotal: number;
  deductionsTotal: number;
}

// Decimal columns (earnings/deductions/gross/net) serialize as strings —
// unlike PayrollRun.totals below, which is a plain JSON object of numbers,
// not a Decimal column.
export interface PayrollItem {
  id: string;
  payrollRunId: string;
  employeeId: string;
  earnings: string;
  deductions: string;
  gross: string;
  net: string;
  employee: { id: string; employeeNo: string; user: { email: string } };
}

export interface PayrollRun {
  id: string;
  period: string;
  status: PayrollRunStatus;
  totals: PayrollTotals | null;
  approvedBy: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  // Only present on create/get/calculate/approve/mark-paid responses, not on
  // the paginated list.
  items?: PayrollItem[];
}
