import { z } from "zod";

export const createCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  externalUrl: z.string().url(),
  category: z.string().optional(),
  mandatory: z.coerce.boolean().default(false),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const updateCourseSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    externalUrl: z.string().url().optional(),
    category: z.string().optional(),
    mandatory: z.coerce.boolean().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

export const listCoursesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  category: z.string().optional(),
});

export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;

export const listEnrollmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  courseId: z.string().uuid().optional(),
  // HR/Super Admin only (EMPLOYEE requesters are always scoped to their own
  // employeeId regardless of this filter — enforced in courses.service.ts).
  employeeId: z.string().uuid().optional(),
});

export type ListEnrollmentsQuery = z.infer<typeof listEnrollmentsQuerySchema>;
