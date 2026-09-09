import type { Request, Response } from "express";
import { requireAuthContext, requireIdParam } from "@common/http/requestHelpers";
import {
  listNotificationsQuerySchema,
  updateNotificationPreferenceSchema,
} from "@modules/notifications/notifications.schema";
import {
  listNotificationPreferences,
  listNotifications,
  markNotificationRead,
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
