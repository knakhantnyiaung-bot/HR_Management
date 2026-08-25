import type { PayrollRunStatus } from "@/types/payroll";

// Mirrors backend payroll.calculator.ts's CalculatePayrollItemResult.snapshotInput
// — a frozen record of what fed the calculation, independent of today's
// mutable SalaryProfile.
export interface PayslipSnapshotInput {
  basicSalary: number;
  allowances: Record<string, number>;
  fixedAllowances: number;
  deductions: Record<string, number>;
  fixedDeductions: number;
  overtime: Array<{ id: string; hours: number; multiplier: number; amount: number }>;
  approvedOvertimePay: number;
  unpaidLeave: Array<{ id: string; days: number; amount: number }>;
  unpaidLeaveDays: number;
  unpaidLeaveDeduction: number;
  bonus: number;
  otherDeductions: number;
}

// Decimal columns (earnings/deductions/gross/net) serialize as strings.
export interface PayslipPayrollItem {
  id: string;
  payrollRunId: string;
  employeeId: string;
  snapshotInput: PayslipSnapshotInput;
  earnings: string;
  deductions: string;
  gross: string;
  net: string;
  employee: { id: string; employeeNo: string; user: { email: string } };
  payrollRun: { id: string; period: string; status: PayrollRunStatus };
}

export interface Payslip {
  id: string;
  releasedAt: string;
  documentRef: string | null;
  payrollItem: PayslipPayrollItem;
}
