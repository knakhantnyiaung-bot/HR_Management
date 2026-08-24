import { z } from "zod";

export const createOvertimeRequestSchema = z
  .object({
    workDate: z.coerce.date(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    multiplier: z.coerce.number().positive().optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export type CreateOvertimeRequestInput = z.infer<typeof createOvertimeRequestSchema>;

export const listOvertimeRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  employeeId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
});

export type ListOvertimeRequestsQuery = z.infer<typeof listOvertimeRequestsQuerySchema>;
