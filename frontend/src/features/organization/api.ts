import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { ListResult } from "@/lib/api/types";
import type { Department, Organization, OrgStructureStatus, Position } from "@/features/organization/types";

// Reference data for select inputs elsewhere (employee forms, filters) — a
// flat org has few enough departments/positions that one page covers it.
export async function fetchDepartments(status?: OrgStructureStatus): Promise<Department[]> {
  const res = await apiClient.get<ApiSuccess<Department[]>>("/departments", {
    params: { pageSize: 100, status },
  });
  return res.data.data;
}

export async function fetchPositions(params: {
  departmentId?: string;
  status?: OrgStructureStatus;
}): Promise<Position[]> {
  const res = await apiClient.get<ApiSuccess<Position[]>>("/positions", {
    params: { pageSize: 100, ...params },
  });
  return res.data.data;
}

export async function getOrganization(): Promise<Organization> {
  const res = await apiClient.get<ApiSuccess<Organization>>("/organization");
  return res.data.data;
}

export interface UpdateOrganizationInput {
  name?: string;
  timezone?: string;
  currency?: string;
  payrollCycle?: string;
}

export async function updateOrganization(input: UpdateOrganizationInput): Promise<Organization> {
  const res = await apiClient.patch<ApiSuccess<Organization>>("/organization", input);
  return res.data.data;
}

export interface ListDepartmentsParams {
  page: number;
  pageSize: number;
  status?: OrgStructureStatus;
}

export async function listDepartments(params: ListDepartmentsParams): Promise<ListResult<Department>> {
  const res = await apiClient.get<ApiSuccess<Department[]>>("/departments", { params });
  return { items: res.data.data, meta: res.data.meta! };
}

export async function createDepartment(name: string): Promise<Department> {
  const res = await apiClient.post<ApiSuccess<Department>>("/departments", { name });
  return res.data.data;
}

export interface UpdateDepartmentInput {
  name?: string;
  status?: OrgStructureStatus;
}

export async function updateDepartment(id: string, input: UpdateDepartmentInput): Promise<Department> {
  const res = await apiClient.patch<ApiSuccess<Department>>(`/departments/${id}`, input);
  return res.data.data;
}

export interface ListPositionsParams {
  page: number;
  pageSize: number;
  departmentId?: string;
  status?: OrgStructureStatus;
}

export async function listPositions(params: ListPositionsParams): Promise<ListResult<Position>> {
  const res = await apiClient.get<ApiSuccess<Position[]>>("/positions", { params });
  return { items: res.data.data, meta: res.data.meta! };
}

export async function createPosition(title: string, departmentId: string): Promise<Position> {
  const res = await apiClient.post<ApiSuccess<Position>>("/positions", { title, departmentId });
  return res.data.data;
}

export interface UpdatePositionInput {
  title?: string;
  departmentId?: string;
  status?: OrgStructureStatus;
}

export async function updatePosition(id: string, input: UpdatePositionInput): Promise<Position> {
  const res = await apiClient.patch<ApiSuccess<Position>>(`/positions/${id}`, input);
  return res.data.data;
}
