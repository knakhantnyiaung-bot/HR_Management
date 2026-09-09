import { candidateApiClient } from "@/lib/api/candidateClient";
import type { ApiSuccess } from "@/lib/api/client";
import type { ListResult } from "@/lib/api/types";
import type { CandidateApplicationView, CandidateMe } from "@/features/careers/types";

export async function fetchCandidateMe(): Promise<CandidateMe> {
  const res = await candidateApiClient.get<ApiSuccess<CandidateMe>>("/candidate-portal/me");
  return res.data.data;
}

export async function applyToJobPosting(jobId: string, resume?: File): Promise<CandidateApplicationView> {
  const formData = resume ? new FormData() : undefined;
  if (formData && resume) {
    formData.append("resume", resume);
  }
  const res = await candidateApiClient.post<ApiSuccess<CandidateApplicationView>>(
    `/candidate-portal/jobs/${jobId}/apply`,
    formData,
    formData ? { headers: { "Content-Type": "multipart/form-data" } } : undefined,
  );
  return res.data.data;
}

export async function listCandidateApplications(
  page = 1,
  pageSize = 20,
): Promise<ListResult<CandidateApplicationView>> {
  const res = await candidateApiClient.get<ApiSuccess<CandidateApplicationView[]>>(
    "/candidate-portal/applications",
    { params: { page, pageSize } },
  );
  return { items: res.data.data, meta: res.data.meta! };
}

export async function getCandidateApplication(id: string): Promise<CandidateApplicationView> {
  const res = await candidateApiClient.get<ApiSuccess<CandidateApplicationView>>(
    `/candidate-portal/applications/${id}`,
  );
  return res.data.data;
}
