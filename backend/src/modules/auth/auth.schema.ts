import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

// NOTIF-08..13 — self-service SMS delivery target. E.164: a leading '+',
// then 1-15 digits, first digit non-zero.
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export const updateMeSchema = z.object({
  phoneNumber: z
    .union([z.string().regex(E164_REGEX, "Must be E.164 format, e.g. +959123456789"), z.null()])
    .optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
