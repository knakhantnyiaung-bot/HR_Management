import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { getCandidateApplication } from "@/features/careers/candidateApi";

// CAREER-08 — the response already omits interviewer identity/feedback/
// score (careers.candidateView.ts does the filtering server-side); this
// page just renders whatever it's given, it doesn't need its own filtering.
export function CandidateApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: application, isLoading, isError, error } = useQuery({
    queryKey: ["candidate-portal", "applications", id],
    queryFn: () => getCandidateApplication(id!),
    enabled: Boolean(id),
  });

  return (
    <div className="app-shell min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link to="/candidate-portal" className="btn-text">
          ← My applications
        </Link>

        {isLoading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
        {isError && (
          <p className="mt-6 error-text">
            {getApiErrorMessage(error, "Could not load this application.")}
          </p>
        )}

        {application && (
          <div className="mt-4 space-y-6">
            <div className="card p-6">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {application.jobPosting.title}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {application.jobPosting.employmentType} · Stage: {application.stage}
              </p>
            </div>

            <div className="card p-6">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Interviews</h2>
              {application.interviews.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">
                  No interviews scheduled yet.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                  {application.interviews.map((interview) => (
                    <li key={interview.id} className="py-2 text-sm text-slate-700 dark:text-slate-300">
                      {formatDateTime(interview.scheduledAt)} · {interview.mode} · {interview.status}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {application.offers.length > 0 && (
              <div className="card p-6">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Offer</h2>
                <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                  {application.offers.map((offer) => (
                    <li key={offer.id} className="py-2 text-sm text-slate-700 dark:text-slate-300">
                      {offer.proposedSalary} {offer.currency} — starting{" "}
                      {new Date(offer.startDate).toLocaleDateString()} ({offer.status})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
