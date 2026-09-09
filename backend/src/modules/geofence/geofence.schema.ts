import { LocationPolicy } from "@prisma/client";
import { z } from "zod";

export const updateGeofencePolicySchema = z.object({
  locationPolicy: z.nativeEnum(LocationPolicy),
});

export type UpdateGeofencePolicyInput = z.infer<typeof updateGeofencePolicySchema>;

export const createGeofenceZoneSchema = z.object({
  label: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().int().positive(),
});

export type CreateGeofenceZoneInput = z.infer<typeof createGeofenceZoneSchema>;

export const updateGeofenceZoneSchema = z
  .object({
    label: z.string().min(1).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusMeters: z.coerce.number().int().positive().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateGeofenceZoneInput = z.infer<typeof updateGeofenceZoneSchema>;
