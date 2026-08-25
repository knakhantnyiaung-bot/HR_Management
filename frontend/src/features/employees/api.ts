import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type {
  CreateEmployeeResult,
  EmployeeStatus,
  EmployeeSummary,
  SalaryProfile,
  WorkModel,
} from "@/features/employees/types";

export interface ListResult<T> {
  items: T[];
  meta: { page: number; pageSize: number; total: number };
}

export interface ListEmployeesParams {
  page: number;
  pageSize: number;
  departmentId?: string;
  status?: EmployeeStatus;
}

export async function listEmployees(params: ListEmployeesParams): Promise<ListResult<EmployeeSummary>> {
  const res = await apiClient.get<ApiSuccess<EmployeeSummary[]>>("/employees", { params });
  return { items: res.data.data, meta: res.data.meta! };
}

export async function getEmployee(id: string): Promise<EmployeeSummary> {
  const res = await apiClient.get<ApiSuccess<EmployeeSummary>>(`/employees/${id}`);
  return res.data.data;
}

export interface CreateEmployeeInput {
  email: string;
  password?: string;
  employeeNo?: string;
  joinDate: string;
  departmentId: string;
  positionId: string;
  workModel: WorkModel;
}

export async function createEmployee(input: CreateEmployeeInput): Promise<CreateEmployeeResult> {
  const res = await apiClient.post<ApiSuccess<CreateEmployeeResult>>("/employees", input);
  return res.data.data;
}

export interface UpdateEmployeeInput {
  departmentId?: string;
  positionId?: string;
  workModel?: WorkModel;
  joinDate?: string;
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<EmployeeSummary> {
  const res = await apiClient.patch<ApiSuccess<EmployeeSummary>>(`/employees/${id}`, input);
  return res.data.data;
}

export async function activateEmployee(id: string): Promise<EmployeeSummary> {
  const res = await apiClient.post<ApiSuccess<EmployeeSummary>>(`/employees/${id}/activate`);
  return res.data.data;
}

export async function deactivateEmployee(id: string): Promise<EmployeeSummary> {
  const res = await apiClient.post<ApiSuccess<EmployeeSummary>>(`/employees/${id}/deactivate`);
  return res.data.data;
}

export async function terminateEmployee(id: string): Promise<EmployeeSummary> {
  const res = await apiClient.post<ApiSuccess<EmployeeSummary>>(`/employees/${id}/terminate`);
  return res.data.data;
}

export async function getCurrentSalaryProfile(employeeId: string): Promise<SalaryProfile> {
  const res = await apiClient.get<ApiSuccess<SalaryProfile>>(`/employees/${employeeId}/salary-profile`);
  return res.data.data;
}

export async function listSalaryProfileHistory(employeeId: string): Promise<SalaryProfile[]> {
  const res = await apiClient.get<ApiSuccess<SalaryProfile[]>>(
    `/employees/${employeeId}/salary-profile/history`,
  );
  return res.data.data;
}

export interface UpsertSalaryProfileInput {
  basicSalary: number;
  effectiveFrom?: string;
  allowances?: Record<string, number>;
  deductions?: Record<string, number>;
  otSettings?: { standardMonthlyHours?: number; standardWorkingDays?: number };
}

export async function upsertSalaryProfile(
  employeeId: string,
  input: UpsertSalaryProfileInput,
): Promise<SalaryProfile> {
  const res = await apiClient.patch<ApiSuccess<SalaryProfile>>(
    `/employees/${employeeId}/salary-profile`,
    input,
  );
  return res.data.data;
}
