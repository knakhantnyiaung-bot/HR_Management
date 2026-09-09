import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listNotifications } from "@/features/notifications/api";

// Sec 17 frontend recommendation — polling is sufficient at MVP scale, no
// WebSocket layer needed for Sprint 2.
const POLL_INTERVAL_MS = 30_000;

export function NotificationBell() {
  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => listNotifications({ page: 1, pageSize: 1, unreadOnly: true }),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const unreadCount = data?.meta.unreadCount ?? 0;

  return (
    <Link
      to="/notifications"
      aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-danger-500 dark:bg-danger-400" />
      )}
    </Link>
  );
}
