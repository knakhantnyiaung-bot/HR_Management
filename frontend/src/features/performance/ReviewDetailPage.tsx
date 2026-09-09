import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDate, formatDateTime } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthContext";
import { getReview, submitManagerReview, submitSelfReview } from "@/features/performance/api";

const HR_ROLES = new Set(["HR_ADMIN", "SUPER_ADMIN"]);
const RATINGS = [1, 2, 3, 4, 5];

export function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const reviewId = id!;
  const { user } = useAuth();
  const isHrRole = Boolean(user && HR_ROLES.has(user.role));
  const queryClient = useQueryClient();

  const { data: review, isLoading, isError, error } = useQuery({
    queryKey: ["performance", "reviews", reviewId],
    queryFn: () => getReview(reviewId),
  });

  const [goals, setGoals] = useState("");
  const [selfRating, setSelfRating] = useState(0);
  const [selfComments, setSelfComments] = useState("");
  const [managerRating, setManagerRating] = useState(0);
  const [managerComments, setManagerComments] = useState("");

  useEffect(() => {
    if (!review) return;
    setGoals(review.goals ?? "");
    setSelfRating(review.selfRating ?? 0);
    setSelfComments(review.selfComments ?? "");
    setManagerRating(review.managerRating ?? 0);
    setManagerComments(review.managerComments ?? "");
  }, [review]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["performance"] });
  }

  const selfMutation = useMutation({
    mutationFn: () => submitSelfReview(reviewId, { goals: goals || undefined, selfRating, selfComments: selfComments || undefined }),
    onSuccess: invalidate,
  });
  const managerMutation = useMutation({
    mutationFn: () =>
      submitManagerReview(reviewId, { managerRating, managerComments: managerComments || undefined }),
    onSuccess: invalidate,
  });

  if (isLoading) return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
  if (isError || !review) {
    return <p className="error-text">{getApiErrorMessage(error, "Could not load this review.")}</p>;
  }

  const isOwnReview = user?.employee?.id === review.employee.id;
  const isManager = user?.employee?.id === review.employee.managerId;
  const canEditSelf = isOwnReview && review.cycle.status === "OPEN";
  const canEditManager = (isManager || isHrRole) && review.cycle.status === "OPEN";

  return (
    <div className="max-w-2xl">
      <Link to="/performance" className="btn-text">
        ← Performance
      </Link>

      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="page-title">
            {review.employee.employeeNo} — {review.cycle.name}
          </h1>
          <p className="page-subtitle">
            {formatDate(review.cycle.periodStart)} – {formatDate(review.cycle.periodEnd)}
          </p>
        </div>
        <StatusBadge status={review.status} />
      </div>

      <div className="mt-6 space-y-8">
        <section className="card space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Self-review</h2>

          {review.selfSubmittedAt && !canEditSelf && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Submitted {formatDateTime(review.selfSubmittedAt)}
            </p>
          )}

          {canEditSelf ? (
            <>
              <div>
                <label className="label-field">Goals for this period</label>
                <textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  rows={3}
                  className="input-field-inset w-full"
                />
              </div>
              <RatingPicker label="Self rating" value={selfRating} onChange={setSelfRating} />
              <div>
                <label className="label-field">Comments</label>
                <textarea
                  value={selfComments}
                  onChange={(e) => setSelfComments(e.target.value)}
                  rows={3}
                  className="input-field-inset w-full"
                />
              </div>
              {selfMutation.isError && (
                <p className="error-text">
                  {getApiErrorMessage(selfMutation.error, "Could not submit your self-review.")}
                </p>
              )}
              <button
                type="button"
                onClick={() => selfMutation.mutate()}
                disabled={selfMutation.isPending || selfRating === 0}
                className="btn-primary"
              >
                {selfMutation.isPending ? "Submitting…" : "Submit self-review"}
              </button>
            </>
          ) : (
            <ReadOnlyReview
              rating={review.selfRating}
              comments={review.selfComments}
              extra={review.goals ? `Goals: ${review.goals}` : null}
              emptyText="Not submitted yet."
            />
          )}
        </section>

        <section className="card space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Manager review</h2>

          {review.managerSubmittedAt && !canEditManager && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Submitted {formatDateTime(review.managerSubmittedAt)}
            </p>
          )}

          {canEditManager ? (
            <>
              <RatingPicker label="Manager rating" value={managerRating} onChange={setManagerRating} />
              <div>
                <label className="label-field">Comments</label>
                <textarea
                  value={managerComments}
                  onChange={(e) => setManagerComments(e.target.value)}
                  rows={3}
                  className="input-field-inset w-full"
                />
              </div>
              {managerMutation.isError && (
                <p className="error-text">
                  {getApiErrorMessage(managerMutation.error, "Could not submit the manager review.")}
                </p>
              )}
              <button
                type="button"
                onClick={() => managerMutation.mutate()}
                disabled={managerMutation.isPending || managerRating === 0}
                className="btn-primary"
              >
                {managerMutation.isPending ? "Submitting…" : "Submit manager review"}
              </button>
            </>
          ) : (
            <ReadOnlyReview
              rating={review.managerRating}
              comments={review.managerComments}
              emptyText="Not submitted yet."
            />
          )}
        </section>
      </div>
    </div>
  );
}

function RatingPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <span className="label-field">{label}</span>
      <div className="mt-1 flex gap-2">
        {RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
              value === r
                ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300"
                : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReadOnlyReview({
  rating,
  comments,
  extra,
  emptyText,
}: {
  rating: number | null;
  comments: string | null;
  extra?: string | null;
  emptyText: string;
}) {
  if (rating === null) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">{emptyText}</p>;
  }
  return (
    <div className="text-sm text-slate-700 dark:text-slate-300">
      <p>Rating: {rating}/5</p>
      {comments && <p className="mt-1">{comments}</p>}
      {extra && <p className="mt-1 text-slate-500 dark:text-slate-400">{extra}</p>}
    </div>
  );
}
