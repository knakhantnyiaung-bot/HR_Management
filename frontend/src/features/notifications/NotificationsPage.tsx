import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import {
  listNotificationPreferences,
  listNotifications,
  markNotificationRead,
  updateNotificationPreference,
} from "@/features/notifications/api";
import { NOTIFICATION_EVENT_TYPES } from "@/features/notifications/types";

export function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => listNotifications({ page: 1, pageSize: 50 }),
  });

  const { data: preferences } = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: listNotificationPreferences,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const preferenceMutation = useMutation({
    mutationFn: ({ eventType, emailEnabled }: { eventType: string; emailEnabled: boolean }) =>
      updateNotificationPreference(eventType, emailEnabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] }),
  });

  function isEmailEnabled(eventType: string): boolean {
    const pref = preferences?.find((p) => p.eventType === eventType);
    // NOTIF-05 — email is on by default until explicitly toggled off.
    return pref ? pref.emailEnabled : true;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Notifications</h1>
        <p className="page-subtitle">Your in-app inbox and email preferences.</p>
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
          Email preferences
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          In-app notifications are always on. Choose which events also send you an email.
        </p>

        <ul className="mt-2 divide-y divide-slate-100 card dark:divide-slate-800">
          {NOTIFICATION_EVENT_TYPES.map((eventType) => (
            <li key={eventType.value} className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-700 dark:text-slate-300">{eventType.label}</span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isEmailEnabled(eventType.value)}
                  onChange={(e) =>
                    preferenceMutation.mutate({
                      eventType: eventType.value,
                      emailEnabled: e.target.checked,
                    })
                  }
                  disabled={preferenceMutation.isPending}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700"
                />
                Email
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
