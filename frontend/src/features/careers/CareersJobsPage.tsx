import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { listPublicJobPostings } from "@/features/careers/api";

// CAREER-01 — public, unauthenticated. A missing/disabled slug 404s here
// the same way it does on the backend; this page doesn't try to
// distinguish "no such org" from "careers page disabled" (careers.service.ts
// intentionally collapses both to the same 404 either way).
export function CareersJobsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["careers", orgSlug, "jobs"],
    queryFn: () => listPublicJobPostings(orgSlug!),
    enabled: Boolean(orgSlug),
    retry: false,
  });

  return (
    <div className="app-shell min-h-screen px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Open positions</h1>
            <p className="page-subtitle">Browse and apply to our current openings.</p>
          </div>
          <Link to={`/careers/${orgSlug}/login`} className="btn-text">
            Candidate sign in
          </Link>
        </div>

        {isLoading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
        {isError && (
          <p className="mt-6 error-text">
            {getApiErrorMessage(error, "This careers page isn't available.")}
          </p>
        )}

        {data && (
          <ul className="mt-6 divide-y divide-slate-100 card dark:divide-slate-800">
            {data.items.length === 0 && (
              <li className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                No open positions right now — check back soon.
              </li>
            )}
            {data.items.map((posting) => (
              <li key={posting.id} className="py-4">
                <Link
                  to={`/careers/${orgSlug}/jobs/${posting.id}`}
                  className="text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {posting.title}
                </Link>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {posting.department.name} · {posting.position.title} · {posting.employmentType}
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Posted {formatDate(posting.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
