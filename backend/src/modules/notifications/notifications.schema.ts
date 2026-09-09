import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.coerce.boolean().default(false),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const updateNotificationPreferenceSchema = z.object({
  eventType: z.string().min(1),
  emailEnabled: z.boolean(),
});

export type UpdateNotificationPreferenceInput = z.infer<typeof updateNotificationPreferenceSchema>;
