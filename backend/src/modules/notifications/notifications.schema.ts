import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.coerce.boolean().default(false),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

// NOTIF-08..13 — emailEnabled/smsEnabled/pushEnabled are each optional so a
// PATCH only has to specify the channel(s) it's changing; a bare
// `{ eventType, smsEnabled: false }` doesn't reset email/push back to their
// defaults. At least one channel must still be present.
export const updateNotificationPreferenceSchema = z
  .object({
    eventType: z.string().min(1),
    emailEnabled: z.boolean().optional(),
    smsEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
  })
  .refine(
    (data) => data.emailEnabled !== undefined || data.smsEnabled !== undefined || data.pushEnabled !== undefined,
    { message: "At least one of emailEnabled, smsEnabled, or pushEnabled must be provided" },
  );

export type UpdateNotificationPreferenceInput = z.infer<typeof updateNotificationPreferenceSchema>;

// NOTIF-08..13 — standard Web Push subscription shape
// (PushSubscription.toJSON() in the browser).
export const registerPushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export type RegisterPushSubscriptionInput = z.infer<typeof registerPushSubscriptionSchema>;

export const removePushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
});

export type RemovePushSubscriptionInput = z.infer<typeof removePushSubscriptionSchema>;
