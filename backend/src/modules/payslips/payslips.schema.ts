import { z } from "zod";

export const listPayslipsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  employeeId: z.string().uuid().optional(),
  period: z.string().optional(),
});

export type ListPayslipsQuery = z.infer<typeof listPayslipsQuerySchema>;
