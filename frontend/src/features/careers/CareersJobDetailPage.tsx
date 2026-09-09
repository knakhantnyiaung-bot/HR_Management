import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { getPublicJobPosting } from "@/features/careers/api";
import { applyToJobPosting } from "@/features/careers/candidateApi";
import { useCandidateAuth } from "@/features/careers/CandidateAuthContext";

export function CareersJobDetailPage() {
  const { orgSlug, jobId } = useParams<{ orgSlug: string; jobId: string }>();
  const { candidate } = useCandidateAuth();
  const [resume, setResume] = useState<File | null>(null);

  const { data: posting, isLoading, isError, error } = useQuery({
    queryKey: ["careers", orgSlug, "jobs", jobId],
    queryFn: () => getPublicJobPosting(orgSlug!, jobId!),
    enabled: Boolean(orgSlug && jobId),
    retry: false,
  });

  const applyMutation = useMutation({
    mutationFn: () => applyToJobPosting(jobId!, resume ?? undefined),
  });

  const redirectTarget = `/careers/${orgSlug}/jobs/${jobId}`;

  return (
    <div className="app-shell min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link to={`/careers/${orgSlug}`} className="btn-text">
          ← All positions
        </Link>

        {isLoading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
        {isError && (
          <p className="mt-6 error-text">{getApiErrorMessage(error, "This posting isn't available.")}</p>
        )}

        {posting && (
          <div className="mt-4 card p-6">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{posting.title}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {posting.department.name} · {posting.position.title} · {posting.employmentType} ·{" "}
              {posting.openings} opening{posting.openings === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Posted {formatDate(posting.createdAt)}
            </p>

            <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-800">
              {!candidate ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <Link
                    to={`/careers/${orgSlug}/login?redirect=${encodeURIComponent(redirectTarget)}`}
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Sign in
                  </Link>{" "}
                  or{" "}
                  <Link
                    to={`/careers/${orgSlug}/register?redirect=${encodeURIComponent(redirectTarget)}`}
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    create an account
                  </Link>{" "}
                  to apply.
                </p>
              ) : applyMutation.isSuccess ? (
                <p className="text-sm text-success-700 dark:text-success-400">
                  Application submitted — you can track its status from{" "}
                  <Link to="/candidate-portal" className="font-medium hover:underline">
                    your applications
                  </Link>
                  .
                </p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    applyMutation.mutate();
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="label-field">Resume (optional, PDF/JPEG/PNG)</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setResume(e.target.files?.[0] ?? null)}
                      className="block text-sm text-slate-600 dark:text-slate-300"
                    />
                  </div>
                  {applyMutation.isError && (
                    <p className="error-text">
                      {getApiErrorMessage(applyMutation.error, "Could not submit your application.")}
                    </p>
                  )}
                  <button type="submit" disabled={applyMutation.isPending} className="btn-primary">
                    {applyMutation.isPending ? "Submitting…" : "Apply"}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
