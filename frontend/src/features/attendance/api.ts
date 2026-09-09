import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { ListResult } from "@/lib/api/types";
import type { CapturedLocation } from "@/lib/geolocation";
import type { AttendanceRecord } from "@/features/attendance/types";

export async function checkIn(location?: CapturedLocation): Promise<AttendanceRecord> {
  const res = await apiClient.post<ApiSuccess<AttendanceRecord>>("/attendance/check-in", location);
  return res.data.data;
}

export async function checkOut(location?: CapturedLocation): Promise<AttendanceRecord> {
  const res = await apiClient.post<ApiSuccess<AttendanceRecord>>("/attendance/check-out", location);
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
