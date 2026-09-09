import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { SelectField } from "@/components/form/SelectField";
import { TextField } from "@/components/form/TextField";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthContext";
import {
  assignHiringManager,
  convertApplication,
  createInterview,
  createOffer,
  downloadCandidateResume,
  getApplication,
  listHiringManagers,
  rescindOffer,
  respondToOffer,
  updateApplicationStage,
  updateInterview,
} from "@/features/recruitment/api";
import type { CandidateApplicationStage, InterviewMode } from "@/features/recruitment/types";

const HR_ROLES = new Set(["HR_ADMIN", "SUPER_ADMIN"]);

const interviewSchema = z.object({
  scheduledAt: z.string().min(1, "Required"),
  mode: z.enum(["ONSITE", "REMOTE"]),
  interviewerNames: z.string().optional(),
});
type InterviewForm = z.infer<typeof interviewSchema>;

const offerSchema = z.object({
  proposedSalary: z.coerce.number().positive("Must be greater than zero"),
  currency: z.string().min(1, "Required"),
  startDate: z.string().min(1, "Required"),
});
type OfferForm = z.infer<typeof offerSchema>;

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const applicationId = id!;
  const { user } = useAuth();
  const isHrRole = Boolean(user && HR_ROLES.has(user.role));
  const queryClient = useQueryClient();
  const [convertResult, setConvertResult] = useState<string | null>(null);

  const { data: application, isLoading, isError, error } = useQuery({
    queryKey: ["recruitment", "applications", "detail", applicationId],
    queryFn: () => getApplication(applicationId),
  });

  const { data: hiringManagers } = useQuery({
    queryKey: ["recruitment", "hiring-managers"],
    queryFn: listHiringManagers,
    enabled: isHrRole,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["recruitment", "applications"] });
  }

  const stageMutation = useMutation({
    mutationFn: (stage: CandidateApplicationStage) => updateApplicationStage(applicationId, stage),
    onSuccess: invalidate,
  });
  const assignMutation = useMutation({
    mutationFn: (hiringManagerUserId: string | null) =>
      assignHiringManager(applicationId, hiringManagerUserId),
    onSuccess: invalidate,
  });
  const convertMutation = useMutation({
    mutationFn: () => convertApplication(applicationId),
    onSuccess: (result) => {
      invalidate();
      setConvertResult(result.temporaryPassword);
    },
  });

  const {
    register: registerInterview,
    handleSubmit: handleInterviewSubmit,
    reset: resetInterviewForm,
    formState: { errors: interviewErrors },
  } = useForm<InterviewForm>({ resolver: zodResolver(interviewSchema), defaultValues: { mode: "ONSITE" } });
  const createInterviewMutation = useMutation({
    mutationFn: (values: InterviewForm) =>
      createInterview(applicationId, {
        scheduledAt: new Date(values.scheduledAt).toISOString(),
        mode: values.mode,
        interviewerNames: values.interviewerNames || undefined,
      }),
    onSuccess: () => {
      invalidate();
      resetInterviewForm();
    },
  });

  const {
    register: registerOffer,
    handleSubmit: handleOfferSubmit,
    reset: resetOfferForm,
    formState: { errors: offerErrors },
  } = useForm<OfferForm>({ resolver: zodResolver(offerSchema), defaultValues: { currency: "MMK" } });
  const createOfferMutation = useMutation({
    mutationFn: (values: OfferForm) =>
      createOffer(applicationId, { ...values, startDate: values.startDate }),
    onSuccess: () => {
      invalidate();
      resetOfferForm({ currency: "MMK" });
    },
  });

  const respondMutation = useMutation({
    mutationFn: ({ offerId, status }: { offerId: string; status: "ACCEPTED" | "DECLINED" }) =>
      respondToOffer(applicationId, offerId, status),
    onSuccess: invalidate,
  });
  const rescindMutation = useMutation({
    mutationFn: (offerId: string) => rescindOffer(applicationId, offerId),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
  }
  if (isError || !application) {
    return (
      <p className="error-text">{getApiErrorMessage(error, "Could not load this application.")}</p>
    );
  }

  const canManageInterviews =
    isHrRole || (user?.role === "HIRING_MANAGER" && application.hiringManager?.id === user.id);
  const activeOffer = application.offers.find((o) => o.status === "DRAFT" || o.status === "SENT");
  const acceptedOffer = application.offers.find((o) => o.status === "ACCEPTED");
  const isTerminalStage = application.stage === "HIRED" || application.stage === "REJECTED" || application.stage === "WITHDRAWN";

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/recruitment"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to recruitment
        </Link>
        <h1 className="page-title mt-2">{application.candidate.fullName}</h1>
        <p className="page-subtitle">
          Applying for {application.jobPosting.title} &middot; <StatusBadge status={application.stage} />
        </p>
      </div>

      {convertResult && (
        <p className="rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-800 dark:bg-warning-900/40 dark:text-warning-300">
          Employee account created. Temporary password: <strong>{convertResult}</strong> — share it
          securely; it will not be shown again.
        </p>
      )}

      <section className="card grid grid-cols-2 gap-4 text-sm">
        <Field label="Email" value={application.candidate.email} />
        <Field label="Phone" value={application.candidate.phone ?? "—"} />
        <Field label="Source" value={application.candidate.source ?? "—"} />
        <div>
          <dt className="text-xs text-slate-400 dark:text-slate-500">Resume</dt>
          <dd className="mt-0.5">
            {application.candidate.resumeFileName ? (
              <button
                type="button"
                onClick={() =>
                  downloadCandidateResume(
                    application.candidate.id,
                    application.candidate.resumeFileName!,
                  )
                }
                className="text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {application.candidate.resumeFileName}
              </button>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </section>

      {isHrRole && (
        <section>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Hiring manager
          </h2>
          <select
            value={application.hiringManager?.id ?? ""}
            onChange={(e) => assignMutation.mutate(e.target.value || null)}
            disabled={assignMutation.isPending}
            className="input-field mt-2"
          >
            <option value="">Unassigned</option>
            {hiringManagers?.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.email}
              </option>
            ))}
          </select>
        </section>
      )}

      {!isTerminalStage && (
        <section>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Stage</h2>
          <div className="mt-2 flex flex-wrap gap-3">
            {application.stage === "APPLIED" && (
              <button
                type="button"
                onClick={() => stageMutation.mutate("SCREENING")}
                disabled={stageMutation.isPending}
                className="btn-secondary"
              >
                Advance to Screening
              </button>
            )}
            {application.stage === "SCREENING" && (
              <button
                type="button"
                onClick={() => stageMutation.mutate("INTERVIEW")}
                disabled={stageMutation.isPending}
                className="btn-secondary"
              >
                Advance to Interview
              </button>
            )}
            <button
              type="button"
              onClick={() => stageMutation.mutate("REJECTED")}
              disabled={stageMutation.isPending}
              className="text-sm text-danger-600 hover:underline disabled:opacity-50 dark:text-danger-400"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => stageMutation.mutate("WITHDRAWN")}
              disabled={stageMutation.isPending}
              className="btn-text hover:underline"
            >
              Mark withdrawn
            </button>
          </div>
          {stageMutation.isError && (
            <p className="mt-2 error-text">
              {getApiErrorMessage(stageMutation.error, "Could not update the stage.")}
            </p>
          )}
        </section>
      )}

      {canManageInterviews && (
        <section>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Interviews</h2>

          <ul className="mt-2 divide-y divide-slate-100 card dark:divide-slate-800">
            {application.interviews.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No interviews scheduled yet.
              </li>
            )}
            {application.interviews.map((interview) => (
              <InterviewRow
                key={interview.id}
                applicationId={applicationId}
                interview={interview}
                onSaved={invalidate}
              />
            ))}
          </ul>

          <form
            onSubmit={handleInterviewSubmit((values) => createInterviewMutation.mutate(values))}
            className="mt-2 space-y-4 card"
          >
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Scheduled at"
                type="datetime-local"
                registration={registerInterview("scheduledAt")}
                error={interviewErrors.scheduledAt?.message}
              />
              <SelectField
                label="Mode"
                registration={registerInterview("mode")}
                options={[
                  { value: "ONSITE", label: "Onsite" },
                  { value: "REMOTE", label: "Remote" },
                ]}
                error={interviewErrors.mode?.message}
              />
              <TextField
                label="Interviewers (optional)"
                registration={registerInterview("interviewerNames")}
                error={interviewErrors.interviewerNames?.message}
              />
            </div>
            {createInterviewMutation.isError && (
              <p className="error-text">
                {getApiErrorMessage(createInterviewMutation.error, "Could not schedule the interview.")}
              </p>
            )}
            <button type="submit" disabled={createInterviewMutation.isPending} className="btn-primary">
              {createInterviewMutation.isPending ? "Scheduling…" : "Schedule interview"}
            </button>
          </form>
        </section>
      )}

      {isHrRole && (
        <section>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Offer</h2>

          <ul className="mt-2 divide-y divide-slate-100 card dark:divide-slate-800">
            {application.offers.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No offers yet.
              </li>
            )}
            {application.offers.map((offer) => (
              <li key={offer.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {offer.proposedSalary} {offer.currency} &middot; starts {formatDateTime(offer.startDate)}
                  </p>
                  <StatusBadge status={offer.status} />
                </div>
                {offer.status === "SENT" && (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => respondMutation.mutate({ offerId: offer.id, status: "ACCEPTED" })}
                      disabled={respondMutation.isPending}
                      className="text-sm font-medium text-success-700 hover:underline disabled:opacity-50 dark:text-success-400"
                    >
                      Record accepted
                    </button>
                    <button
                      type="button"
                      onClick={() => respondMutation.mutate({ offerId: offer.id, status: "DECLINED" })}
                      disabled={respondMutation.isPending}
                      className="text-sm text-danger-600 hover:underline disabled:opacity-50 dark:text-danger-400"
                    >
                      Record declined
                    </button>
                    <button
                      type="button"
                      onClick={() => rescindMutation.mutate(offer.id)}
                      disabled={rescindMutation.isPending}
                      className="btn-text hover:underline"
                    >
                      Rescind
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {!activeOffer && !isTerminalStage && (
            <form
              onSubmit={handleOfferSubmit((values) => createOfferMutation.mutate(values))}
              className="mt-2 space-y-4 card"
            >
              <div className="grid grid-cols-3 gap-4">
                <TextField
                  label="Proposed salary"
                  type="number"
                  registration={registerOffer("proposedSalary")}
                  error={offerErrors.proposedSalary?.message}
                />
                <TextField
                  label="Currency"
                  registration={registerOffer("currency")}
                  error={offerErrors.currency?.message}
                />
                <TextField
                  label="Start date"
                  type="date"
                  registration={registerOffer("startDate")}
                  error={offerErrors.startDate?.message}
                />
              </div>
              {createOfferMutation.isError && (
                <p className="error-text">
                  {getApiErrorMessage(createOfferMutation.error, "Could not create the offer.")}
                </p>
              )}
              <button type="submit" disabled={createOfferMutation.isPending} className="btn-primary">
                {createOfferMutation.isPending ? "Sending…" : "Send offer"}
              </button>
            </form>
          )}

          {acceptedOffer && application.stage !== "HIRED" && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending}
                className="btn-primary"
              >
                {convertMutation.isPending ? "Converting…" : "Convert to employee"}
              </button>
              {convertMutation.isError && (
                <p className="mt-2 error-text">
                  {getApiErrorMessage(convertMutation.error, "Could not convert this candidate.")}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}

function InterviewRow({
  applicationId,
  interview,
  onSaved,
}: {
  applicationId: string;
  interview: { id: string; scheduledAt: string; mode: InterviewMode; feedback: string | null; score: number | null; status: string };
  onSaved: () => void;
}) {
  const [feedback, setFeedback] = useState(interview.feedback ?? "");
  const [score, setScore] = useState(interview.score?.toString() ?? "");

  const updateMutation = useMutation({
    mutationFn: () =>
      updateInterview(applicationId, interview.id, {
        feedback: feedback || undefined,
        score: score ? Number(score) : undefined,
      }),
    onSuccess: onSaved,
  });

  return (
    <li className="space-y-2 py-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-900 dark:text-slate-100">
          {formatDateTime(interview.scheduledAt)} &middot; {interview.mode}
        </p>
        <StatusBadge status={interview.status} />
      </div>
      <div className="flex items-center gap-3">
        <input
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Feedback"
          className="input-field-inset flex-1"
        />
        <input
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="Score"
          type="number"
          className="input-field-inset w-24"
        />
        <button
          type="button"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="btn-text hover:underline"
        >
          Save
        </button>
      </div>
    </li>
  );
}
