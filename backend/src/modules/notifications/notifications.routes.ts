import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import {
  getPushPublicKeyHandler,
  listNotificationPreferencesHandler,
  listNotificationsHandler,
  markNotificationReadHandler,
  registerPushSubscriptionHandler,
  removePushSubscriptionHandler,
  updateNotificationPreferenceHandler,
} from "@modules/notifications/notifications.controller";

// Sprint 2 HLD §12/Appendix B — every route here is "own inbox" scoped; no
// role check beyond authentication, since every user (including Hiring
// Manager) has a notification inbox and preferences.
export const notificationsRouter = Router();

notificationsRouter.get("/", requireAuth, asyncHandler(listNotificationsHandler));
notificationsRouter.patch("/:id/read", requireAuth, asyncHandler(markNotificationReadHandler));

// NOTIF-08..13 — push subscription management, own-device scoped.
notificationsRouter.get("/push-public-key", requireAuth, asyncHandler(getPushPublicKeyHandler));
notificationsRouter.post(
  "/push-subscription",
  requireAuth,
  asyncHandler(registerPushSubscriptionHandler),
);
notificationsRouter.delete(
  "/push-subscription",
  requireAuth,
  asyncHandler(removePushSubscriptionHandler),
);

export const notificationPreferencesRouter = Router();

notificationPreferencesRouter.get(
  "/",
  requireAuth,
  asyncHandler(listNotificationPreferencesHandler),
);
notificationPreferencesRouter.patch(
  "/",
  requireAuth,
  asyncHandler(updateNotificationPreferenceHandler),
);
