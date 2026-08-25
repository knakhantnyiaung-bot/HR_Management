import type { UserRole } from "@/features/auth/types";

export type EmployeeStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "TERMINATED";
export type WorkModel = "OFFICE" | "HYBRID" | "REMOTE";

export interface EmployeeSummary {
  id: string;
  employeeNo: string;
  joinDate: string;
  workModel: WorkModel;
  status: EmployeeStatus;
  department: { id: string; name: string };
  position: { id: string; title: string };
  user: { id: string; email: string; role: UserRole; status: string };
}

export interface CreateEmployeeResult extends EmployeeSummary {
  temporaryPassword?: string;
}

// Decimal (basicSalary) serializes as a string over the wire.
export interface SalaryProfile {
  id: string;
  employeeId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  basicSalary: string;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  otSettings: { standardMonthlyHours?: number; standardWorkingDays?: number } | null;
}
