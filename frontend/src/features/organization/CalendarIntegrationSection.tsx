import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import {
  disconnectCalendarIntegration,
  getCalendarConnectUrl,
  getCalendarIntegrationStatus,
} from "@/features/organization/api";

// CAL-01..07 — org-level, single connected Google account (Sprint 3 HLD
// §8). "Connect" is a real top-level navigation to Google's consent
// screen, not something an XHR mutation can do — the button sets
// window.location itself once it has the URL, rather than being a
// react-query mutation like everything else here.
export function CalendarIntegrationSection() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const callbackResult = searchParams.get("calendar");

  const { data: status, isLoading, isError, error } = useQuery({
    queryKey: ["organization", "calendar-integration"],
    queryFn: getCalendarIntegrationStatus,
  });

  const connectMutation = useMutation({
    mutationFn: getCalendarConnectUrl,
    onSuccess: (url) => {
      window.location.href = url;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectCalendarIntegration,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organization", "calendar-integration"] }),
  });

  function dismissCallbackBanner() {
    const next = new URLSearchParams(searchParams);
    next.delete("calendar");
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Google Calendar</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Connect a Google account to create a calendar event whenever an interview is scheduled.
        Interviews still work without this — it just won't create a calendar event.
      </p>

      {callbackResult === "connected" && (
        <div className="mt-2 flex items-center justify-between rounded-md bg-success-50 px-3 py-2 text-sm text-success-700 dark:bg-success-500/10 dark:text-success-400">
          <span>Google Calendar connected.</span>
          <button type="button" onClick={dismissCallbackBanner} className="btn-text">
            Dismiss
          </button>
        </div>
      )}
      {callbackResult === "error" && (
        <div className="mt-2 flex items-center justify-between rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:bg-danger-500/10 dark:text-danger-400">
          <span>Could not connect Google Calendar. Try again.</span>
          <button type="button" onClick={dismissCallbackBanner} className="btn-text">
            Dismiss
          </button>
        </div>
      )}

      {isLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-2 error-text">{getApiErrorMessage(error, "Could not load calendar status.")}</p>
      )}

      {status && (
        <div className="mt-2 card flex items-center justify-between p-4">
          {status.connected ? (
            <div>
              <p className="text-sm text-slate-900 dark:text-slate-100">Connected</p>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                {status.provider} · connected {formatDate(status.connectedAt)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Not connected</p>
          )}

          {status.connected ? (
            <button
              type="button"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="btn-text text-danger-600 dark:text-danger-400"
            >
              {disconnectMutation.isPending ? "Disconnecting…" : "Disconnect"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="btn-primary"
            >
              {connectMutation.isPending ? "Redirecting…" : "Connect Google Calendar"}
            </button>
          )}
        </div>
      )}
      {(connectMutation.isError || disconnectMutation.isError) && (
        <p className="mt-2 error-text">
          {getApiErrorMessage(
            connectMutation.error ?? disconnectMutation.error,
            "Could not update the calendar connection.",
          )}
        </p>
      )}
    </div>
  );
}
