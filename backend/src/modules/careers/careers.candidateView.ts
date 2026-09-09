import type { CandidateApplication, Interview, JobPosting, Offer } from "@prisma/client";

// CAREER-07/08 — a candidate sees the shape and progress of their own
// application, never internal recruiting detail: interviewer identities,
// interview feedback/score, or which Hiring Manager it's assigned to are
// all left out here on purpose (Sprint 3 HLD §4.1.2). This lives in its own
// file/function specifically so field filtering can't accidentally regress
// when recruitment.service.ts's internal shapes change — this file is the
// one place that has to be kept in sync with "what a candidate may see."
type ApplicationWithCandidateView = CandidateApplication & {
  jobPosting: Pick<JobPosting, "id" | "title" | "employmentType">;
  interviews: Interview[];
  offers: Offer[];
};

export function toCandidateApplicationView(application: ApplicationWithCandidateView) {
  return {
    id: application.id,
    stage: application.stage,
    stageUpdatedAt: application.stageUpdatedAt,
    createdAt: application.createdAt,
    jobPosting: application.jobPosting,
    interviews: application.interviews.map((interview) => ({
      id: interview.id,
      scheduledAt: interview.scheduledAt,
      mode: interview.mode,
      status: interview.status,
    })),
    // A candidate seeing their own offer amount/start date is expected —
    // this isn't the "never leak salary" rule (NOTIF-04), which is about
    // not leaking amounts to a DIFFERENT user.
    offers: application.offers.map((offer) => ({
      id: offer.id,
      proposedSalary: offer.proposedSalary,
      currency: offer.currency,
      startDate: offer.startDate,
      status: offer.status,
      sentAt: offer.sentAt,
      respondedAt: offer.respondedAt,
    })),
  };
}
