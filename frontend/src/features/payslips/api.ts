import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { ListResult } from "@/lib/api/types";
import type { Payslip } from "@/features/payslips/types";

export interface ListPayslipsParams {
  page: number;
  pageSize: number;
  employeeId?: string;
  period?: string;
}

export async function listPayslips(params: ListPayslipsParams): Promise<ListResult<Payslip>> {
  const res = await apiClient.get<ApiSuccess<Payslip[]>>("/payslips", { params });
  return { items: res.data.data, meta: res.data.meta! };
}

export async function getPayslip(id: string): Promise<Payslip> {
  const res = await apiClient.get<ApiSuccess<Payslip>>(`/payslips/${id}`);
  return res.data.data;
}
