export type JobPostingStatus = "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED";

export interface JobPosting {
  id: string;
  title: string;
  departmentId: string;
  positionId: string;
  employmentType: string;
  openings: number;
  status: JobPostingStatus;
}

export type CandidateApplicationStage =
  | "APPLIED"
  | "SCREENING"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN";

export interface Candidate {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  resumeStorageKey: string | null;
  resumeFileName: string | null;
  source: string | null;
  convertedEmployeeId: string | null;
}

export type InterviewMode = "ONSITE" | "REMOTE";
export type InterviewStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface Interview {
  id: string;
  scheduledAt: string;
  mode: InterviewMode;
  interviewerNames: string | null;
  feedback: string | null;
  score: number | null;
  status: InterviewStatus;
}

export type OfferStatus = "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "RESCINDED";

export interface Offer {
  id: string;
  proposedSalary: string;
  currency: string;
  startDate: string;
  status: OfferStatus;
  sentAt: string | null;
  respondedAt: string | null;
}

export interface CandidateApplication {
  id: string;
  candidateId: string;
  jobPostingId: string;
  stage: CandidateApplicationStage;
  stageUpdatedAt: string;
  candidate: Candidate;
  jobPosting: { id: string; title: string; departmentId: string; positionId: string; organizationId: string };
  hiringManager: { id: string; email: string } | null;
  interviews: Interview[];
  offers: Offer[];
}
