import { z } from "zod";

export const listAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  employeeId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;

// HLD section 11: correction is HR-only and requires a mandatory reason.
export const correctAttendanceSchema = z
  .object({
    checkIn: z.coerce.date().optional(),
    checkOut: z.coerce.date().optional(),
    reason: z.string().min(1, "A correction reason is required"),
  })
  .refine((data) => data.checkIn !== undefined || data.checkOut !== undefined, {
    message: "At least one of checkIn or checkOut must be provided",
  });

export type CorrectAttendanceInput = z.infer<typeof correctAttendanceSchema>;

// HLD v1.1 section 11.3, Handbook v1.1 ATT-09/ATT-11/§17.1 — location is
// optional and validated for shape only. Deliberately not a zod schema that
// `.parse()`s and throws: an out-of-range or malformed value must be dropped
// by the service layer, never turned into a 400 that blocks check-in/out.
export interface RawAttendanceLocation {
  lat?: unknown;
  lng?: unknown;
  accuracyMeters?: unknown;
}

export function extractLocation(body: unknown): RawAttendanceLocation {
  if (!body || typeof body !== "object") {
    return {};
  }
  const { lat, lng, accuracyMeters } = body as Record<string, unknown>;
  return { lat, lng, accuracyMeters };
}
