import { z } from "zod";

export const upsertSalaryProfileSchema = z.object({
  basicSalary: z.coerce.number().nonnegative(),
  effectiveFrom: z.coerce.date().optional(),
  allowances: z.record(z.number()).optional(),
  deductions: z.record(z.number()).optional(),
  otSettings: z.record(z.unknown()).optional(),
});

export type UpsertSalaryProfileInput = z.infer<typeof upsertSalaryProfileSchema>;
