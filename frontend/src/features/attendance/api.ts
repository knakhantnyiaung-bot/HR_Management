import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { ListResult } from "@/lib/api/types";
import type { AttendanceRecord } from "@/features/attendance/types";

export async function checkIn(): Promise<AttendanceRecord> {
  const res = await apiClient.post<ApiSuccess<AttendanceRecord>>("/attendance/check-in");
  return res.data.data;
}

export async function checkOut(): Promise<AttendanceRecord> {
  const res = await apiClient.post<ApiSuccess<AttendanceRecord>>("/attendance/check-out");
  return res.data.data;
}

export interface ListAttendanceParams {
  page: number;
  pageSize: number;
  employeeId?: string;
  from?: string;
  to?: string;
}

export async function listAttendance(
  params: ListAttendanceParams,
): Promise<ListResult<AttendanceRecord>> {
  const res = await apiClient.get<ApiSuccess<AttendanceRecord[]>>("/attendance", { params });
  return { items: res.data.data, meta: res.data.meta! };
}

export interface CorrectAttendanceInput {
  checkIn?: string;
  checkOut?: string;
  reason: string;
}

export async function correctAttendance(
  id: string,
  input: CorrectAttendanceInput,
): Promise<AttendanceRecord> {
  const res = await apiClient.post<ApiSuccess<AttendanceRecord>>(`/attendance/${id}/correct`, input);
  return res.data.data;
}
