import jwt from "jsonwebtoken";
import { env } from "@config/env";
import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import { decryptToken, encryptToken } from "@common/crypto/tokenCrypto";
import { recordAudit } from "@modules/audit/audit.service";
import { calendarProvider } from "@modules/calendar/calendarProvider";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
// Google only ever returns a refresh_token once per grant — access_type=
// offline plus prompt=consent are what guarantee this callback gets one
// even on a re-connect, rather than only on the very first authorization.
const AUTH_PARAMS = { access_type: "offline", prompt: "consent" } as const;

function assertGoogleConfigured(): void {
  if (!env.googleClientId || !env.googleClientSecret || !env.googleRedirectUri) {
    throw AppError.badRequest(
      "CALENDAR_INTEGRATION_NOT_CONFIGURED",
      "Google Calendar integration is not configured for this deployment",
    );
  }
}

// CAL-04 — Google's redirect back to our callback is a top-level browser
// navigation with no Authorization header at all (it isn't our SPA's XHR),
// so there's no other way for the callback to know which org/user
// initiated the connection. `state` carries that, signed (reusing
// JWT_SECRET as a generic server-side signing key, not as a session token)
// so it can't be forged into connecting a different org's calendar.
interface CalendarOAuthState {
  organizationId: string;
  userId: string;
}

export function buildGoogleAuthUrl(organizationId: string, userId: string): string {
  assertGoogleConfigured();
  const state = jwt.sign({ organizationId, userId } satisfies CalendarOAuthState, env.jwtSecret, {
    expiresIn: "10m",
  });

  const params = new URLSearchParams({
    client_id: env.googleClientId!,
    redirect_uri: env.googleRedirectUri!,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    state,
    ...AUTH_PARAMS,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

function verifyState(state: string): CalendarOAuthState {
  try {
    return jwt.verify(state, env.jwtSecret) as CalendarOAuthState;
  } catch {
    throw AppError.badRequest(
      "INVALID_OAUTH_STATE",
      "This authorization link has expired or is invalid — try connecting again",
    );
  }
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function exchangeAuthorizationCode(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId!,
      client_secret: env.googleClientSecret!,
      redirect_uri: env.googleRedirectUri!,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw AppError.badRequest("GOOGLE_TOKEN_EXCHANGE_FAILED", "Could not complete Google authorization");
  }
  return (await res.json()) as GoogleTokenResponse;
}

export async function handleGoogleCallback(code: string, state: string): Promise<void> {
  assertGoogleConfigured();
  const { organizationId, userId } = verifyState(state);
  const tokens = await exchangeAuthorizationCode(code);

  if (!tokens.refresh_token) {
    throw AppError.badRequest(
      "GOOGLE_NO_REFRESH_TOKEN",
      "Google did not return a refresh token — revoke this app's access at https://myaccount.google.com/permissions and try connecting again",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.calendarIntegration.upsert({
      where: { organizationId },
      create: {
        organizationId,
        accessTokenEnc: encryptToken(tokens.access_token),
        refreshTokenEnc: encryptToken(tokens.refresh_token!),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        // Wave 1 — the shared account's own default calendar (Sprint 3 HLD
        // §8: one org-level connection, not a picker over that account's
        // other calendars).
        calendarId: "primary",
        connectedByUserId: userId,
      },
      update: {
        accessTokenEnc: encryptToken(tokens.access_token),
        refreshTokenEnc: encryptToken(tokens.refresh_token!),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        connectedByUserId: userId,
        status: "ACTIVE",
      },
    });

    await recordAudit(
      {
        organizationId,
        actorId: userId,
        action: "CALENDAR_INTEGRATION_CONNECTED",
        resourceType: "CalendarIntegration",
        resourceId: organizationId,
      },
      tx,
    );
  });
}

export async function getCalendarIntegrationStatus(organizationId: string) {
  const integration = await prisma.calendarIntegration.findUnique({ where: { organizationId } });
  if (!integration || integration.status !== "ACTIVE") {
    return { connected: false as const };
  }
  return {
    connected: true as const,
    provider: integration.provider,
    calendarId: integration.calendarId,
    connectedAt: integration.createdAt,
  };
}

export async function disconnectCalendarIntegration(organizationId: string, actorId: string): Promise<void> {
  const integration = await prisma.calendarIntegration.findUnique({ where: { organizationId } });
  if (!integration) {
    throw AppError.notFound("CalendarIntegration");
  }

  await prisma.$transaction(async (tx) => {
    await tx.calendarIntegration.delete({ where: { organizationId } });

    await recordAudit(
      {
        organizationId,
        actorId,
        action: "CALENDAR_INTEGRATION_DISCONNECTED",
        resourceType: "CalendarIntegration",
        resourceId: organizationId,
      },
      tx,
    );
  });
}

// Refreshed a little before actual expiry so a request never races a
// same-instant-expired token.
const EXPIRY_BUFFER_MS = 60_000;

async function getValidAccessToken(
  organizationId: string,
): Promise<{ accessToken: string; calendarId: string } | null> {
  const integration = await prisma.calendarIntegration.findUnique({ where: { organizationId } });
  if (!integration || integration.status !== "ACTIVE") {
    return null;
  }

  if (integration.expiresAt.getTime() - EXPIRY_BUFFER_MS > Date.now()) {
    return { accessToken: decryptToken(integration.accessTokenEnc), calendarId: integration.calendarId };
  }

  assertGoogleConfigured();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: decryptToken(integration.refreshTokenEnc),
      client_id: env.googleClientId!,
      client_secret: env.googleClientSecret!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${res.status}`);
  }
  const tokens = (await res.json()) as GoogleTokenResponse;

  await prisma.calendarIntegration.update({
    where: { organizationId },
    data: {
      accessTokenEnc: encryptToken(tokens.access_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  return { accessToken: tokens.access_token, calendarId: integration.calendarId };
}

// ---------------------------------------------------------------------------
// Interview sync — called from recruitment.service.ts, always outside its
// own DB transaction (a network call to Google must never hold a Postgres
// lock open) and always wrapped in try/catch by the caller (HLD §8 — a
// Google failure logs a warning and still persists the interview record).
// ---------------------------------------------------------------------------

interface InterviewerInput {
  name: string;
  email?: string | null;
}

const DEFAULT_INTERVIEW_DURATION_MS = 60 * 60 * 1000;

function toCalendarEventInput(
  scheduledAt: Date,
  interviewers: InterviewerInput[],
  context: { candidateName: string; jobTitle: string },
) {
  return {
    title: `Interview: ${context.candidateName} — ${context.jobTitle}`,
    startTime: scheduledAt,
    endTime: new Date(scheduledAt.getTime() + DEFAULT_INTERVIEW_DURATION_MS),
    attendeeEmails: interviewers
      .map((i) => i.email)
      .filter((email): email is string => Boolean(email)),
  };
}

// Returns the created event's id, or null if this org has no active
// calendar integration (a no-op, not an error).
export async function createCalendarEventForInterview(
  organizationId: string,
  scheduledAt: Date,
  interviewers: InterviewerInput[],
  context: { candidateName: string; jobTitle: string },
): Promise<string | null> {
  const token = await getValidAccessToken(organizationId);
  if (!token) return null;

  const { eventId } = await calendarProvider.createEvent(
    token.accessToken,
    token.calendarId,
    toCalendarEventInput(scheduledAt, interviewers, context),
  );
  return eventId;
}

export async function updateCalendarEventForInterview(
  organizationId: string,
  calendarEventId: string,
  scheduledAt: Date,
  interviewers: InterviewerInput[],
  context: { candidateName: string; jobTitle: string },
): Promise<void> {
  const token = await getValidAccessToken(organizationId);
  if (!token) return;

  await calendarProvider.updateEvent(
    token.accessToken,
    token.calendarId,
    calendarEventId,
    toCalendarEventInput(scheduledAt, interviewers, context),
  );
}

export async function cancelCalendarEventForInterview(
  organizationId: string,
  calendarEventId: string,
): Promise<void> {
  const token = await getValidAccessToken(organizationId);
  if (!token) return;

  await calendarProvider.cancelEvent(token.accessToken, token.calendarId, calendarEventId);
}
