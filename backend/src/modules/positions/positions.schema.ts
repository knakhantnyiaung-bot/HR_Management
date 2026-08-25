import { z } from "zod";

export const createPositionSchema = z.object({
  title: z.string().min(1),
  departmentId: z.string().uuid(),
});

export type CreatePositionInput = z.infer<typeof createPositionSchema>;

// MASTER-01: positions are deactivated, never hard-deleted. No separate
// deactivate route was scaffolded, so status transitions go through this
// same PATCH — the service guards it as an explicit ACTIVE<->INACTIVE
// transition rather than accepting `status` as an arbitrary field write.
export const updatePositionSchema = z
  .object({
    title: z.string().min(1).optional(),
    departmentId: z.string().uuid().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;

export const listPositionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  departmentId: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type ListPositionsQuery = z.infer<typeof listPositionsQuerySchema>;
