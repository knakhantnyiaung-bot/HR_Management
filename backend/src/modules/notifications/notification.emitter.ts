import type { Prisma } from "@prisma/client";
import type { NotificationEventType } from "@modules/notifications/notification.templates";

interface EmitNotificationEventInput {
  organizationId: string;
  eventType: NotificationEventType;
  // Resolved by the caller (e.g. leave.service already knows which HR
  // Admins to notify) — the outbox event fans out to all of these on
  // dispatch. Same shape regardless of recipient count.
  recipientUserIds: string[];
  data: Record<string, unknown>;
  relatedResourceType?: string;
  relatedResourceId?: string;
}

// NOTIF-01/02 — callers pass their own transaction client (`tx`) so this
// insert commits atomically with the business change it announces. A
// downstream dispatch failure must never roll this back; that's why
// dispatch happens later, out-of-band, in notification.queue.ts.
export async function emitNotificationEvent(
  tx: Prisma.TransactionClient,
  input: EmitNotificationEventInput,
): Promise<void> {
  if (input.recipientUserIds.length === 0) {
    return;
  }

  await tx.notificationEvent.create({
    data: {
      organizationId: input.organizationId,
      eventType: input.eventType,
      payload: {
        recipientUserIds: input.recipientUserIds,
        relatedResourceType: input.relatedResourceType ?? null,
        relatedResourceId: input.relatedResourceId ?? null,
        data: input.data,
      } as Prisma.InputJsonValue,
    },
  });
}
