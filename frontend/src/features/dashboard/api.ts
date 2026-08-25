import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { EmployeeDashboard, HrDashboard } from "@/features/dashboard/types";

export async function fetchHrDashboard(): Promise<HrDashboard> {
  const res = await apiClient.get<ApiSuccess<HrDashboard>>("/dashboard/hr");
  return res.data.data;
}

export async function fetchEmployeeDashboard(): Promise<EmployeeDashboard> {
  const res = await apiClient.get<ApiSuccess<EmployeeDashboard>>("/dashboard/me");
  return res.data.data;
}
