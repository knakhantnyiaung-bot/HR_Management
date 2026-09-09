import { Router } from "express";
import { requireAuth, requireRole } from "@common/auth/requireAuth";
import { asyncHandler } from "@common/middleware/asyncHandler";
import {
  calendarOAuthCallbackHandler,
  disconnectCalendarIntegrationHandler,
  getCalendarConnectUrlHandler,
  getCalendarIntegrationStatusHandler,
} from "@modules/calendar/calendar.controller";

// Sprint 3 Wave 1 HLD §8, Handbook CAL-*. Mounted at /organization alongside
// (not nested under) organizations.routes.ts, same pattern as geofence.
// HR Admin/Super Admin connect/disconnect; the callback route is the one
// deliberate exception (see calendar.controller.ts).
export const calendarIntegrationRouter = Router();

const HR_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;

calendarIntegrationRouter.get(
  "/calendar-integration",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(getCalendarIntegrationStatusHandler),
);
calendarIntegrationRouter.get(
  "/calendar-integration/connect-url",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(getCalendarConnectUrlHandler),
);
calendarIntegrationRouter.get(
  "/calendar-integration/callback",
  asyncHandler(calendarOAuthCallbackHandler),
);
calendarIntegrationRouter.delete(
  "/calendar-integration",
  requireAuth,
  requireRole(...HR_ROLES),
  asyncHandler(disconnectCalendarIntegrationHandler),
);
