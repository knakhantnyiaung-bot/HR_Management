import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { ListResult } from "@/lib/api/types";
import type { LeaveBalance, LeaveRequest, LeaveRequestStatus, LeaveType } from "@/features/leave/types";

export async function listLeaveTypes(): Promise<LeaveType[]> {
  const res = await apiClient.get<ApiSuccess<LeaveType[]>>("/leave/types");
  return res.data.data;
}

export interface CreateLeaveTypeInput {
  name: string;
  paid: boolean;
}

export async function createLeaveType(input: CreateLeaveTypeInput): Promise<LeaveType> {
  const res = await apiClient.post<ApiSuccess<LeaveType>>("/leave/types", input);
  return res.data.data;
}

export async function listLeaveBalances(params: {
  employeeId?: string;
  period?: string;
}): Promise<LeaveBalance[]> {
  const res = await apiClient.get<ApiSuccess<LeaveBalance[]>>("/leave/balances", { params });
  return res.data.data;
}

export interface GrantLeaveBalanceInput {
  employeeId: string;
  leaveTypeId: string;
  period: string;
  entitled: number;
}

export async function grantLeaveBalance(input: GrantLeaveBalanceInput): Promise<void> {
  await apiClient.post("/leave/balances", input);
}

export interface CreateLeaveRequestInput {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export async function createLeaveRequest(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
  const res = await apiClient.post<ApiSuccess<LeaveRequest>>("/leave/requests", input);
  return res.data.data;
}

export interface ListLeaveRequestsParams {
  page: number;
  pageSize: number;
  employeeId?: string;
  status?: LeaveRequestStatus;
}

export async function listLeaveRequests(
  params: ListLeaveRequestsParams,
): Promise<ListResult<LeaveRequest>> {
  const res = await apiClient.get<ApiSuccess<LeaveRequest[]>>("/leave/requests", { params });
  return { items: res.data.data, meta: res.data.meta! };
}

export async function approveLeaveRequest(id: string): Promise<LeaveRequest> {
  const res = await apiClient.post<ApiSuccess<LeaveRequest>>(`/leave/requests/${id}/approve`);
  return res.data.data;
}

export async function rejectLeaveRequest(id: string): Promise<LeaveRequest> {
  const res = await apiClient.post<ApiSuccess<LeaveRequest>>(`/leave/requests/${id}/reject`);
  return res.data.data;
}

export async function cancelLeaveRequest(id: string): Promise<LeaveRequest> {
  const res = await apiClient.post<ApiSuccess<LeaveRequest>>(`/leave/requests/${id}/cancel`);
  return res.data.data;
}
