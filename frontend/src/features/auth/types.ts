export type UserRole = "SUPER_ADMIN" | "HR_ADMIN" | "HIRING_MANAGER" | "EMPLOYEE";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface CurrentUser extends AuthUser {
  organizationId: string;
  employee: { id: string; employeeNo: string; status: string } | null;
}
