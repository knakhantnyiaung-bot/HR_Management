import { z } from "zod";

export const updateOrganizationSchema = z
  .object({
    name: z.string().min(1).optional(),
    timezone: z.string().min(1).optional(),
    currency: z.string().min(1).optional(),
    payrollCycle: z.string().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
