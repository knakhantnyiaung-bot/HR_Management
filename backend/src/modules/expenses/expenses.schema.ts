import { z } from "zod";

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1),
  requiresReceipt: z.coerce.boolean().default(false),
});

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;

export const createExpenseClaimSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  expenseDate: z.coerce.date(),
  description: z.string().optional(),
});

export type CreateExpenseClaimInput = z.infer<typeof createExpenseClaimSchema>;

// EXP-01 — only DRAFT claims may be edited by their owner.
export const updateExpenseClaimSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    amount: z.coerce.number().positive().optional(),
    expenseDate: z.coerce.date().optional(),
    description: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateExpenseClaimInput = z.infer<typeof updateExpenseClaimSchema>;

export const rejectExpenseClaimSchema = z.object({
  reason: z.string().min(1, "A rejection reason is required"),
});

export type RejectExpenseClaimInput = z.infer<typeof rejectExpenseClaimSchema>;

export const listExpenseClaimsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  employeeId: z.string().uuid().optional(),
  status: z
    .enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "REIMBURSED", "CANCELLED"])
    .optional(),
});

export type ListExpenseClaimsQuery = z.infer<typeof listExpenseClaimsQuerySchema>;
