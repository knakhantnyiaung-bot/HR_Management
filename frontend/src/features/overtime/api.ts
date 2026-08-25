import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { ListResult } from "@/lib/api/types";
import type { OvertimeRequest, OvertimeRequestStatus } from "@/features/overtime/types";

export interface CreateOvertimeRequestInput {
  workDate: string;
  startTime: string;
  endTime: string;
  multiplier?: number;
}

export async function createOvertimeRequest(
  input: CreateOvertimeRequestInput,
): Promise<OvertimeRequest> {
  const res = await apiClient.post<ApiSuccess<OvertimeRequest>>("/overtime/requests", input);
  return res.data.data;
}

export interface ListOvertimeRequestsParams {
  page: number;
  pageSize: number;
  employeeId?: string;
  status?: OvertimeRequestStatus;
}

export async function listOvertimeRequests(
  params: ListOvertimeRequestsParams,
): Promise<ListResult<OvertimeRequest>> {
  const res = await apiClient.get<ApiSuccess<OvertimeRequest[]>>("/overtime/requests", { params });
  return { items: res.data.data, meta: res.data.meta! };
}

export async function approveOvertimeRequest(id: string): Promise<OvertimeRequest> {
  const res = await apiClient.post<ApiSuccess<OvertimeRequest>>(`/overtime/requests/${id}/approve`);
  return res.data.data;
}

export async function rejectOvertimeRequest(id: string): Promise<OvertimeRequest> {
  const res = await apiClient.post<ApiSuccess<OvertimeRequest>>(`/overtime/requests/${id}/reject`);
  return res.data.data;
}

export async function cancelOvertimeRequest(id: string): Promise<OvertimeRequest> {
  const res = await apiClient.post<ApiSuccess<OvertimeRequest>>(`/overtime/requests/${id}/cancel`);
  return res.data.data;
}
