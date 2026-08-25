import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { ListResult } from "@/lib/api/types";
import type { PayrollRun } from "@/features/payroll/types";
import type { PayrollRunStatus } from "@/types/payroll";

export async function createPayrollRun(period: string): Promise<PayrollRun> {
  const res = await apiClient.post<ApiSuccess<PayrollRun>>("/payroll/runs", { period });
  return res.data.data;
}

export interface ListPayrollRunsParams {
  page: number;
  pageSize: number;
  status?: PayrollRunStatus;
}

export async function listPayrollRuns(
  params: ListPayrollRunsParams,
): Promise<ListResult<PayrollRun>> {
  const res = await apiClient.get<ApiSuccess<PayrollRun[]>>("/payroll/runs", { params });
  return { items: res.data.data, meta: res.data.meta! };
}

export async function getPayrollRun(id: string): Promise<PayrollRun> {
  const res = await apiClient.get<ApiSuccess<PayrollRun>>(`/payroll/runs/${id}`);
  return res.data.data;
}

export async function calculatePayrollRun(id: string): Promise<PayrollRun> {
  const res = await apiClient.post<ApiSuccess<PayrollRun>>(`/payroll/runs/${id}/calculate`);
  return res.data.data;
}

export async function approvePayrollRun(id: string): Promise<PayrollRun> {
  const res = await apiClient.post<ApiSuccess<PayrollRun>>(`/payroll/runs/${id}/approve`);
  return res.data.data;
}

export async function markPayrollRunPaid(id: string): Promise<PayrollRun> {
  const res = await apiClient.post<ApiSuccess<PayrollRun>>(`/payroll/runs/${id}/mark-paid`);
  return res.data.data;
}
