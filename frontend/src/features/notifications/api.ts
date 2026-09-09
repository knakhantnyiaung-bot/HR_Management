import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { Notification, NotificationPreference } from "@/features/notifications/types";

export interface ListNotificationsParams {
  page: number;
  pageSize: number;
  unreadOnly?: boolean;
}

export interface NotificationsMeta {
  page: number;
  pageSize: number;
  total: number;
  unreadCount: number;
}

export async function listNotifications(
  params: ListNotificationsParams,
): Promise<{ items: Notification[]; meta: NotificationsMeta }> {
  const res = await apiClient.get<ApiSuccess<Notification[]>>("/notifications", { params });
  return { items: res.data.data, meta: res.data.meta as unknown as NotificationsMeta };
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const res = await apiClient.patch<ApiSuccess<Notification>>(`/notifications/${id}/read`);
  return res.data.data;
}

export async function listNotificationPreferences(): Promise<NotificationPreference[]> {
  const res = await apiClient.get<ApiSuccess<NotificationPreference[]>>("/notification-preferences");
  return res.data.data;
}

export type NotificationChannel = "emailEnabled" | "smsEnabled" | "pushEnabled";

export async function updateNotificationPreference(
  eventType: string,
  channel: NotificationChannel,
  enabled: boolean,
): Promise<NotificationPreference> {
  const res = await apiClient.patch<ApiSuccess<NotificationPreference>>("/notification-preferences", {
    eventType,
    [channel]: enabled,
  });
  return res.data.data;
}

// NOTIF-08..13 — push subscription management.
export async function getPushPublicKey(): Promise<string> {
  const res = await apiClient.get<ApiSuccess<{ publicKey: string }>>("/notifications/push-public-key");
  return res.data.data.publicKey;
}

export async function registerPushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
  await apiClient.post("/notifications/push-subscription", {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
  });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await apiClient.delete("/notifications/push-subscription", { data: { endpoint } });
}
