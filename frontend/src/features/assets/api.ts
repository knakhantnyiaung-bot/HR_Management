import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { ListResult } from "@/lib/api/types";
import type { Asset, AssetAssignment, AssetCategory, AssetStatus } from "@/features/assets/types";

export interface ListAssetsParams {
  page: number;
  pageSize: number;
  status?: AssetStatus;
  category?: AssetCategory;
  employeeId?: string;
}

export async function listAssets(params: ListAssetsParams): Promise<ListResult<Asset>> {
  const res = await apiClient.get<ApiSuccess<Asset[]>>("/assets", { params });
  return { items: res.data.data, meta: res.data.meta! };
}

export interface CreateAssetInput {
  assetTag: string;
  name: string;
  category: AssetCategory;
  serialNumber?: string;
  notes?: string;
}

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  const res = await apiClient.post<ApiSuccess<Asset>>("/assets", input);
  return res.data.data;
}

export interface UpdateAssetInput {
  name?: string;
  category?: AssetCategory;
  serialNumber?: string;
  notes?: string;
  status?: "AVAILABLE" | "IN_REPAIR" | "RETIRED";
}

export async function updateAsset(id: string, input: UpdateAssetInput): Promise<Asset> {
  const res = await apiClient.patch<ApiSuccess<Asset>>(`/assets/${id}`, input);
  return res.data.data;
}

export async function assignAsset(id: string, employeeId: string, notes?: string): Promise<Asset> {
  const res = await apiClient.post<ApiSuccess<Asset>>(`/assets/${id}/assign`, { employeeId, notes });
  return res.data.data;
}

export async function returnAsset(id: string, notes?: string): Promise<Asset> {
  const res = await apiClient.post<ApiSuccess<Asset>>(`/assets/${id}/return`, { notes });
  return res.data.data;
}

export async function listAssetAssignments(id: string): Promise<AssetAssignment[]> {
  const res = await apiClient.get<ApiSuccess<AssetAssignment[]>>(`/assets/${id}/assignments`);
  return res.data.data;
}
