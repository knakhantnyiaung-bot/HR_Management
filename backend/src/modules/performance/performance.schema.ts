import { z } from "zod";

export const createReviewCycleSchema = z
  .object({
    name: z.string().min(1),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "periodEnd must be on or after periodStart",
    path: ["periodEnd"],
  });

export type CreateReviewCycleInput = z.infer<typeof createReviewCycleSchema>;

export const listReviewCyclesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListReviewCyclesQuery = z.infer<typeof listReviewCyclesQuerySchema>;

// PERF-04 — 1-5, a fixed simple scale (Wave 2 scope: no configurable
// rating scales).
const rating = z.coerce.number().int().min(1).max(5);

export const submitSelfReviewSchema = z.object({
  goals: z.string().optional(),
  selfRating: rating,
  selfComments: z.string().optional(),
});

export type SubmitSelfReviewInput = z.infer<typeof submitSelfReviewSchema>;

export const submitManagerReviewSchema = z.object({
  managerRating: rating,
  managerComments: z.string().optional(),
});

export type SubmitManagerReviewInput = z.infer<typeof submitManagerReviewSchema>;

export const listReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  cycleId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
});

export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;
