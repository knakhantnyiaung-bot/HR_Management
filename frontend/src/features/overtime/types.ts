export type OvertimeRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

// Decimal columns (hours, multiplier) serialize as strings.
export interface OvertimeRequest {
  id: string;
  employeeId: string;
  workDate: string;
  startTime: string;
  endTime: string;
  hours: string;
  multiplier: string;
  status: OvertimeRequestStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  employee: { id: string; employeeNo: string; user: { email: string } };
}
