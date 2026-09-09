import { prisma } from "@database/prisma";
import { AppError } from "@common/errors/AppError";
import type {
  ListNotificationsQuery,
  RegisterPushSubscriptionInput,
  UpdateNotificationPreferenceInput,
} from "@modules/notifications/notifications.schema";

// NOTIF-05 — in-app delivery is always on; email/SMS/push are user-toggleable.
export async function listNotifications(
  organizationId: string,
  userId: string,
  query: ListNotificationsQuery,
) {
  const where = {
    organizationId,
    userId,
    ...(query.unreadOnly ? { readAt: null } : {}),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { organizationId, userId, readAt: null } }),
  ]);

  return { items, meta: { page: query.page, pageSize: query.pageSize, total, unreadCount } };
}

export async function markNotificationRead(organizationId: string, userId: string, id: string) {
  const notification = await prisma.notification.findFirst({
    where: { id, organizationId, userId },
  });
  if (!notification) {
    throw AppError.notFound("Notification");
  }
  if (notification.readAt) {
    return notification;
  }
  return prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
}

export async function listNotificationPreferences(userId: string) {
  return prisma.notificationPreference.findMany({ where: { userId } });
}

export async function upsertNotificationPreference(
  userId: string,
  input: UpdateNotificationPreferenceInput,
) {
  return prisma.notificationPreference.upsert({
    where: { userId_eventType: { userId, eventType: input.eventType } },
    create: {
      userId,
      eventType: input.eventType,
      emailEnabled: input.emailEnabled ?? true,
      smsEnabled: input.smsEnabled ?? true,
      pushEnabled: input.pushEnabled ?? true,
    },
    update: {
      ...(input.emailEnabled !== undefined ? { emailEnabled: input.emailEnabled } : {}),
      ...(input.smsEnabled !== undefined ? { smsEnabled: input.smsEnabled } : {}),
      ...(input.pushEnabled !== undefined ? { pushEnabled: input.pushEnabled } : {}),
    },
  });
}

// NOTIF-08..13 — registering an already-known (userId, endpoint) pair just
// refreshes it; a browser can re-subscribe with the same endpoint (e.g.
// after clearing permission state) without creating a duplicate row.
export async function registerPushSubscription(
  userId: string,
  input: RegisterPushSubscriptionInput,
) {
  return prisma.pushSubscription.upsert({
    where: { userId_endpoint: { userId, endpoint: input.endpoint } },
    create: { userId, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth },
    update: { p256dh: input.keys.p256dh, auth: input.keys.auth },
  });
}

export async function removePushSubscription(userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}
