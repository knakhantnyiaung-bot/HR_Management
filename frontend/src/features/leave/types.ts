export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveType {
  id: string;
  name: string;
  paid: boolean;
  policySettings: Record<string, unknown> | null;
}

// Decimal columns (entitled/used/remaining, days) serialize as strings.
export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  period: string;
  entitled: string;
  used: string;
  remaining: string;
  leaveType: { id: string; name: string; paid: boolean };
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: string;
  status: LeaveRequestStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  reason: string | null;
  createdAt: string;
  employee: { id: string; employeeNo: string; user: { email: string } };
  leaveType: { id: string; name: string; paid: boolean };
}
