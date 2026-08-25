import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(1),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

// MASTER-01: departments are deactivated, never hard-deleted. No separate
// deactivate route was scaffolded, so status transitions go through this
// same PATCH — the service guards it as an explicit ACTIVE<->INACTIVE
// transition rather than accepting `status` as an arbitrary field write.
export const updateDepartmentSchema = z
  .object({
    name: z.string().min(1).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

export const listDepartmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type ListDepartmentsQuery = z.infer<typeof listDepartmentsQuerySchema>;
