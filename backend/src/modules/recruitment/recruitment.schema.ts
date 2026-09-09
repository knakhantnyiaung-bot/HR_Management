import { CandidateApplicationStage, InterviewMode, InterviewStatus } from "@prisma/client";
import { z } from "zod";

export const createJobPostingSchema = z.object({
  title: z.string().min(1),
  departmentId: z.string().uuid(),
  positionId: z.string().uuid(),
  employmentType: z.string().min(1),
  openings: z.coerce.number().int().positive().default(1),
});

export type CreateJobPostingInput = z.infer<typeof createJobPostingSchema>;

export const updateJobPostingStatusSchema = z.object({
  status: z.enum(["DRAFT", "OPEN", "CLOSED", "ARCHIVED"]),
});

export type UpdateJobPostingStatusInput = z.infer<typeof updateJobPostingStatusSchema>;

export const listJobPostingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["DRAFT", "OPEN", "CLOSED", "ARCHIVED"]).optional(),
});

export type ListJobPostingsQuery = z.infer<typeof listJobPostingsQuerySchema>;

// REC-01 — HR/Recruiter-entered only; fullName/email/phone/source are the
// only fields (no public application form fields like cover letters etc.).
export const createCandidateSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().transform((v) => v.toLowerCase()),
  phone: z.string().optional(),
  source: z.string().optional(),
});

export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;

export const listApplicationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  jobPostingId: z.string().uuid().optional(),
  stage: z.nativeEnum(CandidateApplicationStage).optional(),
  // Filters to "applications assigned to me" — the frontend uses this for
  // the Hiring Manager view rather than relying on client-side filtering.
  assignedToMe: z.coerce.boolean().optional(),
  // There is no single-application GET endpoint (Appendix B) — the frontend
  // detail page fetches one application via this filter instead.
  id: z.string().uuid().optional(),
});

export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;

// HIRED is deliberately excluded — reachable only via the /convert action
// (HANDOFF-01..06), never via this generic stage-set endpoint.
export const updateApplicationStageSchema = z.object({
  stage: z.enum(["SCREENING", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"]),
});

export type UpdateApplicationStageInput = z.infer<typeof updateApplicationStageSchema>;

export const assignHiringManagerSchema = z.object({
  hiringManagerUserId: z.string().uuid().nullable(),
});

export type AssignHiringManagerInput = z.infer<typeof assignHiringManagerSchema>;

// CAL-01..07 — replaces Sprint 2's free-text interviewerNames. email is
// optional per interviewer (someone might only know a name at scheduling
// time) — createCalendarEventForInterview filters to interviewers with an
// email when building the Google Calendar event's attendee list.
const interviewerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
});

export const createInterviewSchema = z.object({
  scheduledAt: z.coerce.date(),
  mode: z.nativeEnum(InterviewMode).default(InterviewMode.ONSITE),
  interviewers: z.array(interviewerSchema).default([]),
});

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;

export const updateInterviewSchema = z
  .object({
    scheduledAt: z.coerce.date().optional(),
    mode: z.nativeEnum(InterviewMode).optional(),
    interviewers: z.array(interviewerSchema).optional(),
    feedback: z.string().optional(),
    score: z.coerce.number().int().min(0).max(100).optional(),
    status: z.nativeEnum(InterviewStatus).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>;

export const createOfferSchema = z.object({
  proposedSalary: z.coerce.number().positive(),
  currency: z.string().min(1),
  startDate: z.coerce.date(),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;

export const respondOfferSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
});

export type RespondOfferInput = z.infer<typeof respondOfferSchema>;

// There is no other account-creation path for this role (§3 — Hiring
// Manager is not an Employee); HR creates the login directly, same
// temp-password-if-omitted convention as employees.schema.ts.
export const createHiringManagerSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(8).optional(),
});

export type CreateHiringManagerInput = z.infer<typeof createHiringManagerSchema>;
