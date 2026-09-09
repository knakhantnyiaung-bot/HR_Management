import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TextField } from "@/components/form/TextField";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthContext";
import {
  closeReviewCycle,
  createReviewCycle,
  listReviewCycles,
  listReviews,
  openReviewCycle,
} from "@/features/performance/api";

const HR_ROLES = new Set(["HR_ADMIN", "SUPER_ADMIN"]);

const cycleSchema = z.object({
  name: z.string().min(1, "Required"),
  periodStart: z.string().min(1, "Required"),
  periodEnd: z.string().min(1, "Required"),
});
type CycleForm = z.infer<typeof cycleSchema>;

export function PerformancePage() {
  const { user } = useAuth();
  const isHrRole = Boolean(user && HR_ROLES.has(user.role));
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: cycles, isLoading, isError, error } = useQuery({
    queryKey: ["performance", "cycles"],
    queryFn: listReviewCycles,
    enabled: isHrRole,
  });

  const { data: reviews } = useQuery({
    queryKey: ["performance", "reviews", "mine"],
    queryFn: () => listReviews({ page: 1, pageSize: 50 }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CycleForm>({ resolver: zodResolver(cycleSchema) });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["performance"] });
  }

  const createMutation = useMutation({
    mutationFn: createReviewCycle,
    onSuccess: () => {
      invalidate();
      reset();
      setShowForm(false);
    },
  });
  const openMutation = useMutation({ mutationFn: openReviewCycle, onSuccess: invalidate });
  const closeMutation = useMutation({ mutationFn: closeReviewCycle, onSuccess: invalidate });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Performance</h1>
        <p className="page-subtitle">Review cycles, self-review, and manager feedback.</p>
      </div>

      {isHrRole && (
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Review cycles</h2>
            {!showForm && (
              <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
                New cycle
              </button>
            )}
          </div>

          {showForm && (
            <form
              onSubmit={handleSubmit((values) => createMutation.mutate(values))}
              className="mt-2 space-y-4 card"
            >
              <div className="grid grid-cols-3 gap-4">
                <TextField label="Name" registration={register("name")} error={errors.name?.message} />
                <TextField
                  label="Period start"
                  type="date"
                  registration={register("periodStart")}
                  error={errors.periodStart?.message}
                />
                <TextField
                  label="Period end"
                  type="date"
                  registration={register("periodEnd")}
                  error={errors.periodEnd?.message}
                />
              </div>
              {createMutation.isError && (
                <p className="error-text">
                  {getApiErrorMessage(createMutation.error, "Could not create the cycle.")}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                  {createMutation.isPending ? "Adding…" : "Add cycle"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-text">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {isLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
          {isError && (
            <p className="mt-2 error-text">{getApiErrorMessage(error, "Could not load cycles.")}</p>
          )}
          {(openMutation.isError || closeMutation.isError) && (
            <p className="mt-2 error-text">
              {getApiErrorMessage(openMutation.error ?? closeMutation.error, "That action failed.")}
            </p>
          )}

          {cycles && (
            <ul className="mt-2 divide-y divide-slate-100 card dark:divide-slate-800">
              {cycles.items.length === 0 && (
                <li className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                  No review cycles yet.
                </li>
              )}
              {cycles.items.map((cycle) => (
                <li key={cycle.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{cycle.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(cycle.periodStart)} – {formatDate(cycle.periodEnd)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={cycle.status} />
                    {cycle.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={() => openMutation.mutate(cycle.id)}
                        disabled={openMutation.isPending}
                        className="btn-text"
                      >
                        Open
                      </button>
                    )}
                    {cycle.status === "OPEN" && (
                      <button
                        type="button"
                        onClick={() => closeMutation.mutate(cycle.id)}
                        disabled={closeMutation.isPending}
                        className="btn-text"
                      >
                        Close
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {isHrRole ? "All reviews" : "My reviews"}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Includes your own review, and reviews for anyone who reports to you.
        </p>

        {reviews && (
          <ul className="mt-2 divide-y divide-slate-100 card dark:divide-slate-800">
            {reviews.items.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No reviews yet.
              </li>
            )}
            {reviews.items.map((review) => (
              <li key={review.id} className="flex items-center justify-between py-3">
                <div>
                  <Link
                    to={`/performance/reviews/${review.id}`}
                    className="text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {review.employee.employeeNo} — {review.cycle.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {review.employee.user.email}
                  </p>
                </div>
                <StatusBadge status={review.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
