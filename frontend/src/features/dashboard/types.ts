import type { PayrollRunStatus } from "@/types/payroll";

// Decimal columns (money, hours, days) serialize as strings over the wire —
// Prisma.Decimal -> JSON — so amounts here are strings, not numbers.

export interface HrDashboard {
  activeEmployees: number;
  presentToday: number;
  onLeave: number;
  pendingLeave: number;
  pendingOT: number;
  currentPayroll: { period: string; status: PayrollRunStatus | null };
  payrollCost: { label: "net"; amount: number | null };
}

export interface LeaveBalanceSummary {
  id: string;
  leaveTypeId: string;
  period: string;
  entitled: string;
  used: string;
  remaining: string;
  leaveType: { id: string; name: string; paid: boolean };
}

export interface PayslipSummary {
  id: string;
  releasedAt: string;
  documentRef: string | null;
  payrollItem: {
    id: string;
    gross: string;
    deductions: string;
    net: string;
    payrollRun: { id: string; period: string; status: PayrollRunStatus };
  };
}

export interface EmployeeDashboard {
  attendanceToday: { checkIn: string; checkOut: string | null; workingMinutes: number | null } | null;
  leaveBalances: LeaveBalanceSummary[];
  pendingRequests: { leave: number; overtime: number };
  latestPayslip: PayslipSummary | null;
}
