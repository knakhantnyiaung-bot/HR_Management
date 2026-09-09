import { GeofenceShape, LocationPolicy } from "@prisma/client";
import { z } from "zod";

export const updateGeofencePolicySchema = z.object({
  locationPolicy: z.nativeEnum(LocationPolicy),
});

export type UpdateGeofencePolicyInput = z.infer<typeof updateGeofencePolicySchema>;

// GEO-10 — a zone is either a circle (center + radius) or a polygon (an
// ordered vertex list). 3-50 vertices: 3 is the minimum to enclose any
// area, 50 keeps the payload and the point-in-polygon check bounded.
const polygonPointSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

const circleFields = {
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().int().positive(),
};

// `shape` defaults to CIRCLE so Sprint 2 callers that never send it (the
// current frontend form, geofence.test.ts) keep validating unchanged.
// Per-shape field requirements (GEO-13: a CIRCLE payload must not also
// carry a polygon, and vice versa) are cross-field, so they're checked in
// geofence.service.ts alongside the existing-zone lookup rather than here —
// same "business rule lives in the service" split Sprint 2 used for
// REC-03/REC-05.
export const createGeofenceZoneSchema = z.object({
  label: z.string().min(1),
  shape: z.nativeEnum(GeofenceShape).default(GeofenceShape.CIRCLE),
  lat: circleFields.lat.optional(),
  lng: circleFields.lng.optional(),
  radiusMeters: circleFields.radiusMeters.optional(),
  polygon: z.array(polygonPointSchema).min(3).max(50).optional(),
});

export type CreateGeofenceZoneInput = z.infer<typeof createGeofenceZoneSchema>;

export const updateGeofenceZoneSchema = z
  .object({
    label: z.string().min(1).optional(),
    shape: z.nativeEnum(GeofenceShape).optional(),
    lat: circleFields.lat.optional(),
    lng: circleFields.lng.optional(),
    radiusMeters: circleFields.radiusMeters.optional(),
    polygon: z.array(polygonPointSchema).min(3).max(50).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateGeofenceZoneInput = z.infer<typeof updateGeofenceZoneSchema>;
