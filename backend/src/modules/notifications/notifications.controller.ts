import type { Request, Response } from "express";
import { env } from "@config/env";
import { AppError } from "@common/errors/AppError";
import { requireAuthContext, requireIdParam } from "@common/http/requestHelpers";
import {
  listNotificationsQuerySchema,
  registerPushSubscriptionSchema,
  removePushSubscriptionSchema,
  updateNotificationPreferenceSchema,
} from "@modules/notifications/notifications.schema";
import {
  listNotificationPreferences,
  listNotifications,
  markNotificationRead,
  registerPushSubscription,
  removePushSubscription,
  upsertNotificationPreference,
} from "@modules/notifications/notifications.service";

export async function listNotificationsHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const query = listNotificationsQuerySchema.parse(req.query);
  const result = await listNotifications(organizationId, userId, query);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function markNotificationReadHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const notification = await markNotificationRead(organizationId, userId, requireIdParam(req));
  res.json({ success: true, data: notification });
}

export async function listNotificationPreferencesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const preferences = await listNotificationPreferences(userId);
  res.json({ success: true, data: preferences });
}

export async function updateNotificationPreferenceHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const input = updateNotificationPreferenceSchema.parse(req.body);
  const preference = await upsertNotificationPreference(userId, input);
  res.json({ success: true, data: preference });
}

// NOTIF-08..13 — the VAPID public key the browser's PushManager.subscribe()
// needs as its applicationServerKey. 404s (rather than a 200 with null) if
// the deployment hasn't configured one, so the frontend can tell "push
// isn't available here" apart from "request failed".
export async function getPushPublicKeyHandler(_req: Request, res: Response): Promise<void> {
  if (!env.vapidPublicKey) {
    throw AppError.notFound("Push public key");
  }
  res.json({ success: true, data: { publicKey: env.vapidPublicKey } });
}

export async function registerPushSubscriptionHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuthContext(req);
  const input = registerPushSubscriptionSchema.parse(req.body);
  const subscription = await registerPushSubscription(userId, input);
  res.status(201).json({ success: true, data: subscription });
}

export async function removePushSubscriptionHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuthContext(req);
  const input = removePushSubscriptionSchema.parse(req.body);
  await removePushSubscription(userId, input.endpoint);
  res.json({ success: true, data: null });
}
