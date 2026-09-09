import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { ListResult } from "@/lib/api/types";
import type { PerformanceReview, ReviewCycle } from "@/features/performance/types";

export async function listReviewCycles(): Promise<ListResult<ReviewCycle>> {
  const res = await apiClient.get<ApiSuccess<ReviewCycle[]>>("/performance/cycles", {
    params: { page: 1, pageSize: 50 },
  });
  return { items: res.data.data, meta: res.data.meta! };
}

export interface CreateReviewCycleInput {
  name: string;
  periodStart: string;
  periodEnd: string;
}

export async function createReviewCycle(input: CreateReviewCycleInput): Promise<ReviewCycle> {
  const res = await apiClient.post<ApiSuccess<ReviewCycle>>("/performance/cycles", input);
  return res.data.data;
}

export async function openReviewCycle(id: string): Promise<ReviewCycle> {
  const res = await apiClient.post<ApiSuccess<ReviewCycle>>(`/performance/cycles/${id}/open`);
  return res.data.data;
}

export async function closeReviewCycle(id: string): Promise<ReviewCycle> {
  const res = await apiClient.post<ApiSuccess<ReviewCycle>>(`/performance/cycles/${id}/close`);
  return res.data.data;
}

export interface ListReviewsParams {
  page: number;
  pageSize: number;
  cycleId?: string;
}

export async function listReviews(params: ListReviewsParams): Promise<ListResult<PerformanceReview>> {
  const res = await apiClient.get<ApiSuccess<PerformanceReview[]>>("/performance/reviews", { params });
  return { items: res.data.data, meta: res.data.meta! };
}

export async function getReview(id: string): Promise<PerformanceReview> {
  const res = await apiClient.get<ApiSuccess<PerformanceReview>>(`/performance/reviews/${id}`);
  return res.data.data;
}

export interface SubmitSelfReviewInput {
  goals?: string;
  selfRating: number;
  selfComments?: string;
}

export async function submitSelfReview(id: string, input: SubmitSelfReviewInput): Promise<PerformanceReview> {
  const res = await apiClient.patch<ApiSuccess<PerformanceReview>>(`/performance/reviews/${id}/self`, input);
  return res.data.data;
}

export interface SubmitManagerReviewInput {
  managerRating: number;
  managerComments?: string;
}

export async function submitManagerReview(
  id: string,
  input: SubmitManagerReviewInput,
): Promise<PerformanceReview> {
  const res = await apiClient.patch<ApiSuccess<PerformanceReview>>(
    `/performance/reviews/${id}/manager`,
    input,
  );
  return res.data.data;
}
