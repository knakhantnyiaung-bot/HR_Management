import { z } from "zod";

export const createLeaveTypeSchema = z.object({
  name: z.string().min(1),
  paid: z.boolean().default(true),
  policySettings: z.record(z.unknown()).optional(),
});

export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;

export const grantLeaveBalanceSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  period: z.string().min(1),
  entitled: z.coerce.number().min(0),
});

export type GrantLeaveBalanceInput = z.infer<typeof grantLeaveBalanceSchema>;

export const listLeaveBalancesQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  period: z.string().optional(),
});

export type ListLeaveBalancesQuery = z.infer<typeof listLeaveBalancesQuerySchema>;

export const createLeaveRequestSchema = z
  .object({
    leaveTypeId: z.string().uuid(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().min(1).optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

export const listLeaveRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  employeeId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
});

export type ListLeaveRequestsQuery = z.infer<typeof listLeaveRequestsQuerySchema>;
