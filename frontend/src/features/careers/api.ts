import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { ListResult } from "@/lib/api/types";
import type { PublicJobPosting } from "@/features/careers/types";

// CAREER-01/02 — fully public, no auth. Reuses the shared apiClient: if an
// internal (HR) session also happens to be logged in on this browser, its
// Bearer token rides along on these requests too, which is harmless — none
// of these routes read it.
export async function listPublicJobPostings(
  orgSlug: string,
  page = 1,
  pageSize = 20,
): Promise<ListResult<PublicJobPosting>> {
  const res = await apiClient.get<ApiSuccess<PublicJobPosting[]>>(`/careers/${orgSlug}/jobs`, {
    params: { page, pageSize },
  });
  return { items: res.data.data, meta: res.data.meta! };
}

export async function getPublicJobPosting(orgSlug: string, jobId: string): Promise<PublicJobPosting> {
  const res = await apiClient.get<ApiSuccess<PublicJobPosting>>(`/careers/${orgSlug}/jobs/${jobId}`);
  return res.data.data;
}

export interface RegisterCandidateInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface CandidateAuthResult {
  token: string;
  candidate: { id: string; fullName: string; email: string };
}

export async function registerCandidate(
  orgSlug: string,
  input: RegisterCandidateInput,
): Promise<CandidateAuthResult> {
  const res = await apiClient.post<ApiSuccess<CandidateAuthResult>>(
    `/careers/${orgSlug}/register`,
    input,
  );
  return res.data.data;
}

export interface LoginCandidateInput {
  email: string;
  password: string;
}

export async function loginCandidate(
  orgSlug: string,
  input: LoginCandidateInput,
): Promise<CandidateAuthResult> {
  const res = await apiClient.post<ApiSuccess<CandidateAuthResult>>(`/careers/${orgSlug}/login`, input);
  return res.data.data;
}
