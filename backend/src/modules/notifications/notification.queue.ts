import { NotificationEventStatus, type NotificationEvent } from "@prisma/client";
import { prisma } from "@database/prisma";
import { renderNotification } from "@modules/notifications/notification.templates";

// Sprint 2 plan's infra deviation note: the HLD (§12.1, ADR-011/012) calls
// for a Redis/BullMQ-backed worker process. This repo has no Redis and no
// separate worker deployment today, so this ships as an in-process poller
// against the same durable Postgres outbox table instead. The
// dispatch/idempotency contract (NOTIF-01..07) is unchanged — only the
// queue transport is simplified. Swapping to a real queue later means
// replacing `start()`'s setInterval with a Redis consumer that calls
// `processOneEvent`; no domain service changes.
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 5000;
const MAX_DELAY_MS = 300000;

// Appendix C — delay(attempt) = min(base * 2^(attempt-1), max).
function backoffDelayMs(attempt: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
}

interface EventPayloadShape {
  recipientUserIds?: string[];
  relatedResourceType?: string | null;
  relatedResourceId?: string | null;
  data?: Record<string, unknown>;
}

// Stand-in for a real email provider (NOTIF-04: link back only, never
// salary/expense amounts or GPS coordinates in the body — the templates in
// notification.templates.ts already guarantee that). Swappable behind this
// one function once real SMTP/provider credentials exist.
function sendEmailStub(userId: string, subject: string, body: string): void {
  // eslint-disable-next-line no-console
  console.log(`[email stub] to user ${userId}: ${subject} — ${body}`);
}

// NOTIF-03 — processing one event (render, create in-app rows, "send"
// email, mark PROCESSED) happens inside a single transaction with a status
// re-check, so a re-processed event id can never duplicate in-app rows.
export async function processOneEvent(event: NotificationEvent): Promise<void> {
  try {
    const payload = event.payload as EventPayloadShape;
    const recipientUserIds = payload.recipientUserIds ?? [];
    const data = payload.data ?? {};
    const rendered = renderNotification(event.eventType, data);

    await prisma.$transaction(async (tx) => {
      const current = await tx.notificationEvent.findUnique({
        where: { id: event.id },
        select: { status: true },
      });
      if (!current || current.status !== NotificationEventStatus.PENDING) {
        return;
      }

      if (recipientUserIds.length > 0) {
        const preferences = await tx.notificationPreference.findMany({
          where: { userId: { in: recipientUserIds }, eventType: event.eventType },
        });
        const emailDisabled = new Set(
          preferences.filter((p) => !p.emailEnabled).map((p) => p.userId),
        );

        await tx.notification.createMany({
          data: recipientUserIds.map((userId) => ({
            organizationId: event.organizationId,
            userId,
            eventType: event.eventType,
            title: rendered.title,
            message: rendered.inAppMessage,
            relatedResourceType: payload.relatedResourceType ?? null,
            relatedResourceId: payload.relatedResourceId ?? null,
          })),
        });

        for (const userId of recipientUserIds) {
          if (!emailDisabled.has(userId)) {
            sendEmailStub(userId, rendered.title, rendered.emailBody);
          }
        }
      }

      await tx.notificationEvent.update({
        where: { id: event.id },
        data: { status: NotificationEventStatus.PROCESSED, processedAt: new Date() },
      });
    });
  } catch (err) {
    await handleFailure(event, err);
  }
}

async function handleFailure(event: NotificationEvent, err: unknown): Promise<void> {
  const attempts = event.attempts + 1;
  const message = err instanceof Error ? err.message : String(err);

  await prisma.notificationEvent.update({
    where: { id: event.id },
    data:
      attempts >= MAX_ATTEMPTS
        ? { status: NotificationEventStatus.FAILED, attempts, lastError: message }
        : {
            attempts,
            lastError: message,
            nextAttemptAt: new Date(Date.now() + backoffDelayMs(attempts)),
          },
  });
}

export async function processPendingEvents(): Promise<void> {
  const events = await prisma.notificationEvent.findMany({
    where: { status: NotificationEventStatus.PENDING, nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  for (const event of events) {
    await processOneEvent(event);
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let isTicking = false;

// NOTIF-07 — if this loop is never started (or throws), events simply
// accumulate as PENDING in Postgres; nothing is lost, and a later restart
// drains the backlog. `isTicking` guards against overlapping ticks if a
// batch takes longer than POLL_INTERVAL_MS.
export function startNotificationDispatcher(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    if (isTicking) return;
    isTicking = true;
    processPendingEvents()
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[notifications] dispatcher tick failed", err);
      })
      .finally(() => {
        isTicking = false;
      });
  }, POLL_INTERVAL_MS);
}

export function stopNotificationDispatcher(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
