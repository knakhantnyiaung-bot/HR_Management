export interface PublicJobPosting {
  id: string;
  title: string;
  employmentType: string;
  openings: number;
  createdAt: string;
  department: { name: string };
  position: { title: string };
}

export interface CandidateMe {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  createdAt: string;
}

export type ApplicationStage =
  | "APPLIED"
  | "SCREENING"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN";

export interface CandidateInterviewView {
  id: string;
  scheduledAt: string;
  mode: "ONSITE" | "REMOTE";
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
}

export interface CandidateOfferView {
  id: string;
  proposedSalary: string;
  currency: string;
  startDate: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "RESCINDED";
  sentAt: string | null;
  respondedAt: string | null;
}

export interface CandidateApplicationView {
  id: string;
  stage: ApplicationStage;
  stageUpdatedAt: string;
  createdAt: string;
  jobPosting: { id: string; title: string; employmentType: string };
  interviews: CandidateInterviewView[];
  offers: CandidateOfferView[];
}
