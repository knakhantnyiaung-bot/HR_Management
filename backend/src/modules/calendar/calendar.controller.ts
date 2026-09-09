import type { Request, Response } from "express";
import { env } from "@config/env";
import { requireAuthContext } from "@common/http/requestHelpers";
import {
  buildGoogleAuthUrl,
  disconnectCalendarIntegration,
  getCalendarIntegrationStatus,
  handleGoogleCallback,
} from "@modules/calendar/calendar.service";

export async function getCalendarIntegrationStatusHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const status = await getCalendarIntegrationStatus(organizationId);
  res.json({ success: true, data: status });
}

export async function getCalendarConnectUrlHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const url = buildGoogleAuthUrl(organizationId, userId);
  res.json({ success: true, data: { url } });
}

// CAL-04 — public: this is Google redirecting the user's browser directly,
// not our SPA's XHR, so there's no Authorization header to check here.
// `state` (verified inside handleGoogleCallback) is what stands in for
// auth on this one request. Always redirects the browser back to the
// frontend rather than returning JSON — the user is looking at a browser
// page mid-navigation, not consuming an API response.
export async function calendarOAuthCallbackHandler(req: Request, res: Response): Promise<void> {
  const redirectBase = env.corsOrigin[0];
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

  if (error || !code || !state) {
    res.redirect(`${redirectBase}/settings?calendar=error`);
    return;
  }

  try {
    await handleGoogleCallback(code, state);
    res.redirect(`${redirectBase}/settings?calendar=connected`);
  } catch {
    res.redirect(`${redirectBase}/settings?calendar=error`);
  }
}

export async function disconnectCalendarIntegrationHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  await disconnectCalendarIntegration(organizationId, userId);
  res.json({ success: true, data: null });
}
