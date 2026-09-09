import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { fetchCurrentUser, updateCurrentUser } from "@/features/auth/api";
import {
  disablePushNotifications,
  enablePushNotifications,
  getExistingPushSubscription,
  isPushSupported,
} from "@/lib/pushSubscription";
import {
  listNotificationPreferences,
  listNotifications,
  markNotificationRead,
  updateNotificationPreference,
  type NotificationChannel,
} from "@/features/notifications/api";
import { NOTIFICATION_EVENT_TYPES } from "@/features/notifications/types";

const CHANNELS: Array<{ key: NotificationChannel; label: string }> = [
  { key: "emailEnabled", label: "Email" },
  { key: "smsEnabled", label: "SMS" },
  { key: "pushEnabled", label: "Push" },
];

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushPending, setPushPending] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => listNotifications({ page: 1, pageSize: 50 }),
  });

  const { data: preferences } = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: listNotificationPreferences,
  });

  const { data: currentUser } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchCurrentUser,
  });

  useEffect(() => {
    setPhoneNumber(currentUser?.phoneNumber ?? "");
  }, [currentUser?.phoneNumber]);

  useEffect(() => {
    getExistingPushSubscription().then((sub) => setPushEnabled(sub !== null));
  }, []);

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const preferenceMutation = useMutation({
    mutationFn: ({
      eventType,
      channel,
      enabled,
    }: {
      eventType: string;
      channel: NotificationChannel;
      enabled: boolean;
    }) => updateNotificationPreference(eventType, channel, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] }),
  });

  const phoneNumberMutation = useMutation({
    mutationFn: (value: string) => updateCurrentUser(value.trim() === "" ? null : value.trim()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
  });

  function isChannelEnabled(eventType: string, channel: NotificationChannel): boolean {
    const pref = preferences?.find((p) => p.eventType === eventType);
    // NOTIF-05/08..13 — every channel is on by default until explicitly
    // toggled off.
    return pref ? pref[channel] : true;
  }

  async function handleTogglePush() {
    setPushError(null);
    setPushPending(true);
    try {
      if (pushEnabled) {
        await disablePushNotifications();
        setPushEnabled(false);
      } else {
        await enablePushNotifications();
        setPushEnabled(true);
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Could not update push notifications.");
    } finally {
      setPushPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Notifications</h1>
        <p className="page-subtitle">Your in-app inbox and delivery preferences.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Inbox</h2>

        {isLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
        {isError && (
          <p className="mt-2 error-text">
            {getApiErrorMessage(error, "Could not load notifications.")}
          </p>
        )}

        {data && (
          <ul className="mt-2 divide-y divide-slate-100 card dark:divide-slate-800">
            {data.items.length === 0 && (
              <li className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                No notifications yet.
              </li>
            )}
            {data.items.map((notification) => (
              <li
                key={notification.id}
                className={`flex items-start justify-between gap-4 py-3 ${
                  notification.readAt ? "" : "bg-indigo-50/50 dark:bg-indigo-500/5"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {notification.title}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {formatDateTime(notification.createdAt)}
                  </p>
                </div>
                {!notification.readAt && (
                  <button
                    type="button"
                    onClick={() => markReadMutation.mutate(notification.id)}
                    disabled={markReadMutation.isPending}
                    className="btn-text shrink-0 hover:underline"
                  >
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Delivery settings
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          A phone number is required for SMS delivery; this browser must have push notifications
          enabled to receive push delivery.
        </p>

        <div className="mt-2 flex flex-wrap items-end gap-3 card">
          <div className="flex-1">
            <label className="label-field">Phone number (E.164, e.g. +959123456789)</label>
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+959123456789"
              className="input-field-inset w-full"
            />
          </div>
          <button
            type="button"
            onClick={() => phoneNumberMutation.mutate(phoneNumber)}
            disabled={phoneNumberMutation.isPending}
            className="btn-primary"
          >
            {phoneNumberMutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
        {phoneNumberMutation.isError && (
          <p className="mt-2 error-text">
            {getApiErrorMessage(phoneNumberMutation.error, "Could not save phone number.")}
          </p>
        )}

        {isPushSupported() ? (
          <div className="mt-4">
            <button type="button" onClick={handleTogglePush} disabled={pushPending} className="btn-text">
              {pushPending ? "Working…" : pushEnabled ? "Disable push notifications" : "Enable push notifications"}
            </button>
            {pushError && <p className="mt-2 error-text">{pushError}</p>}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
            Push notifications aren't supported in this browser.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Notification preferences
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          In-app notifications are always on. Choose which events also reach you by email, SMS, or push.
        </p>

        <div className="mt-2 overflow-hidden card-table">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="table-head-cell">Event</th>
                {CHANNELS.map((channel) => (
                  <th key={channel.key} className="table-head-cell text-center">
                    {channel.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {NOTIFICATION_EVENT_TYPES.map((eventType) => (
                <tr key={eventType.value}>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{eventType.label}</td>
                  {CHANNELS.map((channel) => (
                    <td key={channel.key} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChannelEnabled(eventType.value, channel.key)}
                        onChange={(e) =>
                          preferenceMutation.mutate({
                            eventType: eventType.value,
                            channel: channel.key,
                            enabled: e.target.checked,
                          })
                        }
                        disabled={preferenceMutation.isPending}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
