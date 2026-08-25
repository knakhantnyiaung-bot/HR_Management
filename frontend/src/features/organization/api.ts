import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { Department, OrgStructureStatus, Position } from "@/features/organization/types";

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
