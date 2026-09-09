import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { listCandidateApplications } from "@/features/careers/candidateApi";
import { useCandidateAuth } from "@/features/careers/CandidateAuthContext";

const STAGE_LABELS: Record<string, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Not selected",
  WITHDRAWN: "Withdrawn",
};

export function CandidatePortalPage() {
  const { candidate, logout } = useCandidateAuth();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["candidate-portal", "applications"],
    queryFn: () => listCandidateApplications(),
  });

  return (
    <div className="app-shell min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">My applications</h1>
            <p className="page-subtitle">Signed in as {candidate?.email}</p>
          </div>
          <button type="button" onClick={logout} className="btn-text">
            Sign out
          </button>
        </div>

        {isLoading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
        {isError && (
          <p className="mt-6 error-text">{getApiErrorMessage(error, "Could not load your applications.")}</p>
        )}

        {data && (
          <ul className="mt-6 divide-y divide-slate-100 card dark:divide-slate-800">
            {data.items.length === 0 && (
              <li className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                You haven't applied to any positions yet.
              </li>
            )}
            {data.items.map((application) => (
              <li key={application.id} className="flex items-center justify-between py-4">
                <div>
                  <Link
                    to={`/candidate-portal/applications/${application.id}`}
                    className="text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {application.jobPosting.title}
                  </Link>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Applied {formatDate(application.createdAt)}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {STAGE_LABELS[application.stage] ?? application.stage}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
