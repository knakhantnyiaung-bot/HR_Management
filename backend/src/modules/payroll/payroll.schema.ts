import { z } from "zod";

// HLD MVP assumption: payroll is monthly (section 1 table), so a period is
// a calendar month.
export const createPayrollRunSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "period must be in YYYY-MM format"),
});

export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;

export const listPayrollRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["DRAFT", "CALCULATED", "APPROVED", "PAID"]).optional(),
});

export type ListPayrollRunsQuery = z.infer<typeof listPayrollRunsQuerySchema>;
