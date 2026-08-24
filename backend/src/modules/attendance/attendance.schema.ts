import { z } from "zod";

export const listAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  employeeId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;

// HLD section 11: correction is HR-only and requires a mandatory reason.
export const correctAttendanceSchema = z
  .object({
    checkIn: z.coerce.date().optional(),
    checkOut: z.coerce.date().optional(),
    reason: z.string().min(1, "A correction reason is required"),
  })
  .refine((data) => data.checkIn !== undefined || data.checkOut !== undefined, {
    message: "At least one of checkIn or checkOut must be provided",
  });

export type CorrectAttendanceInput = z.infer<typeof correctAttendanceSchema>;
