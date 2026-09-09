import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { ListResult } from "@/lib/api/types";
import type {
  CandidateApplication,
  CandidateApplicationStage,
  Interview,
  InterviewMode,
  Interviewer,
  JobPosting,
  JobPostingStatus,
  Offer,
  OfferStatus,
} from "@/features/recruitment/types";

export interface HiringManager {
  id: string;
  email: string;
  status: string;
}

export async function listHiringManagers(): Promise<HiringManager[]> {
  const res = await apiClient.get<ApiSuccess<HiringManager[]>>("/recruitment/hiring-managers");
  return res.data.data;
}

export interface CreateHiringManagerResult {
  user: { id: string; email: string };
  temporaryPassword?: string;
}

export async function createHiringManager(input: {
  email: string;
}): Promise<CreateHiringManagerResult> {
  const res = await apiClient.post<ApiSuccess<CreateHiringManagerResult>>(
    "/recruitment/hiring-managers",
    input,
  );
  return res.data.data;
}

export interface ListJobPostingsParams {
  page: number;
  pageSize: number;
  status?: JobPostingStatus;
}

export async function listJobPostings(params: ListJobPostingsParams): Promise<ListResult<JobPosting>> {
  const res = await apiClient.get<ApiSuccess<JobPosting[]>>("/recruitment/postings", { params });
  return { items: res.data.data, meta: res.data.meta! };
}

export interface CreateJobPostingInput {
  title: string;
  departmentId: string;
  positionId: string;
  employmentType: string;
  openings: number;
}

export async function createJobPosting(input: CreateJobPostingInput): Promise<JobPosting> {
  const res = await apiClient.post<ApiSuccess<JobPosting>>("/recruitment/postings", input);
  return res.data.data;
}

export async function updateJobPostingStatus(
  id: string,
  status: JobPostingStatus,
): Promise<JobPosting> {
  const res = await apiClient.patch<ApiSuccess<JobPosting>>(`/recruitment/postings/${id}/status`, {
    status,
  });
  return res.data.data;
}

export interface CreateCandidateInput {
  fullName: string;
  email: string;
  phone?: string;
  source?: string;
  resume?: File;
}

export async function createCandidate(
  jobPostingId: string,
  input: CreateCandidateInput,
): Promise<CandidateApplication> {
  const formData = new FormData();
  formData.append("fullName", input.fullName);
  formData.append("email", input.email);
  if (input.phone) formData.append("phone", input.phone);
  if (input.source) formData.append("source", input.source);
  if (input.resume) formData.append("resume", input.resume);

  const res = await apiClient.post<ApiSuccess<CandidateApplication>>(
    `/recruitment/postings/${jobPostingId}/candidates`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data.data;
}

export interface ListApplicationsParams {
  page: number;
  pageSize: number;
  jobPostingId?: string;
  stage?: CandidateApplicationStage;
  assignedToMe?: boolean;
}

export async function listApplications(
  params: ListApplicationsParams,
): Promise<ListResult<CandidateApplication>> {
  const res = await apiClient.get<ApiSuccess<CandidateApplication[]>>("/recruitment/applications", {
    params,
  });
  return { items: res.data.data, meta: res.data.meta! };
}

// No single-application GET endpoint (Appendix B lists only the collection
// route) — the `id` query filter narrows that same list endpoint to one row.
export async function getApplication(id: string): Promise<CandidateApplication> {
  const res = await apiClient.get<ApiSuccess<CandidateApplication[]>>("/recruitment/applications", {
    params: { page: 1, pageSize: 1, id },
  });
  return res.data.data[0];
}

export async function updateApplicationStage(
  id: string,
  stage: CandidateApplicationStage,
): Promise<CandidateApplication> {
  const res = await apiClient.patch<ApiSuccess<CandidateApplication>>(
    `/recruitment/applications/${id}/stage`,
    { stage },
  );
  return res.data.data;
}

export async function assignHiringManager(
  id: string,
  hiringManagerUserId: string | null,
): Promise<CandidateApplication> {
  const res = await apiClient.patch<ApiSuccess<CandidateApplication>>(
    `/recruitment/applications/${id}/assign`,
    { hiringManagerUserId },
  );
  return res.data.data;
}

export interface CreateInterviewInput {
  scheduledAt: string;
  mode: InterviewMode;
  interviewers: Interviewer[];
}

export async function createInterview(
  applicationId: string,
  input: CreateInterviewInput,
): Promise<Interview> {
  const res = await apiClient.post<ApiSuccess<Interview>>(
    `/recruitment/applications/${applicationId}/interviews`,
    input,
  );
  return res.data.data;
}

export async function updateInterview(
  applicationId: string,
  interviewId: string,
  input: {
    scheduledAt?: string;
    mode?: InterviewMode;
    interviewers?: Interviewer[];
    feedback?: string;
    score?: number;
    status?: string;
  },
): Promise<Interview> {
  const res = await apiClient.patch<ApiSuccess<Interview>>(
    `/recruitment/applications/${applicationId}/interviews/${interviewId}`,
    input,
  );
  return res.data.data;
}

export interface CreateOfferInput {
  proposedSalary: number;
  currency: string;
  startDate: string;
}

export async function createOffer(applicationId: string, input: CreateOfferInput): Promise<Offer> {
  const res = await apiClient.post<ApiSuccess<Offer>>(
    `/recruitment/applications/${applicationId}/offer`,
    input,
  );
  return res.data.data;
}

export async function respondToOffer(
  applicationId: string,
  offerId: string,
  status: Extract<OfferStatus, "ACCEPTED" | "DECLINED">,
): Promise<Offer> {
  const res = await apiClient.post<ApiSuccess<Offer>>(
    `/recruitment/applications/${applicationId}/offer/${offerId}/respond`,
    { status },
  );
  return res.data.data;
}

export async function rescindOffer(applicationId: string, offerId: string): Promise<Offer> {
  const res = await apiClient.post<ApiSuccess<Offer>>(
    `/recruitment/applications/${applicationId}/offer/${offerId}/rescind`,
  );
  return res.data.data;
}

export interface ConvertApplicationResult {
  employee: { id: string; employeeNo: string };
  temporaryPassword: string;
  application: CandidateApplication;
}

export async function convertApplication(applicationId: string): Promise<ConvertApplicationResult> {
  const res = await apiClient.post<ApiSuccess<ConvertApplicationResult>>(
    `/recruitment/applications/${applicationId}/convert`,
  );
  return res.data.data;
}

export async function downloadCandidateResume(candidateId: string, fileName: string): Promise<void> {
  const res = await apiClient.get(`/recruitment/candidates/${candidateId}/resume`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
}
