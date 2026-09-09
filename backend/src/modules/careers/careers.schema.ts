import { z } from "zod";

export const listPublicJobPostingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListPublicJobPostingsQuery = z.infer<typeof listPublicJobPostingsQuerySchema>;

// CAREER-03 — same email/password shape as internal login, plus the basic
// candidate profile fields REC-01's HR-entry form already collects
// (fullName/phone/source). No email verification in Wave 1 (HLD §4.1.4 —
// documented known gap, not silently skipped).
export const registerCandidateSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(8),
  fullName: z.string().min(1),
  phone: z.string().optional(),
});

export type RegisterCandidateInput = z.infer<typeof registerCandidateSchema>;

export const loginCandidateSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(1),
});

export type LoginCandidateInput = z.infer<typeof loginCandidateSchema>;

export const listCandidateApplicationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListCandidateApplicationsQuery = z.infer<typeof listCandidateApplicationsQuerySchema>;
