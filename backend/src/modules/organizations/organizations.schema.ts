import { z } from "zod";

export const updateOrganizationSchema = z
  .object({
    name: z.string().min(1).optional(),
    timezone: z.string().min(1).optional(),
    currency: z.string().min(1).optional(),
    payrollCycle: z.string().min(1).optional(),
    // locationPolicy moved to the geofence module in Sprint 2 — see
    // GET/PATCH /organization/geofence-policy (geofence.routes.ts).
    // CAREER-01/09 — url-safe, lowercase; null clears the slug (and
    // therefore takes the public careers page down, per CAREER-01's
    // "no slug means no page" rule).
    careersSlug: z
      .union([
        z
          .string()
          .min(3)
          .max(50)
          .regex(/^[a-z0-9-]+$/, "Must be lowercase letters, numbers, and hyphens only"),
        z.null(),
      ])
      .optional(),
    careersEnabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
