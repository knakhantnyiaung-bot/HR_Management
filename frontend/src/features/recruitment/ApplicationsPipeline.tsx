import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthContext";
import { assignHiringManager, listApplications, listHiringManagers } from "@/features/recruitment/api";
import type { CandidateApplicationStage } from "@/features/recruitment/types";

const STAGE_OPTIONS: CandidateApplicationStage[] = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
];

const HR_ROLES = new Set(["HR_ADMIN", "SUPER_ADMIN"]);

export function ApplicationsPipeline() {
  const { user } = useAuth();
  const isHrRole = Boolean(user && HR_ROLES.has(user.role));
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<CandidateApplicationStage | "">("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["recruitment", "applications", { stage }],
    queryFn: () => listApplications({ page: 1, pageSize: 50, stage: stage || undefined }),
  });

  const { data: hiringManagers } = useQuery({
    queryKey: ["recruitment", "hiring-managers"],
    queryFn: listHiringManagers,
    enabled: isHrRole,
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, hiringManagerUserId }: { id: string; hiringManagerUserId: string | null }) =>
      assignHiringManager(id, hiringManagerUserId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recruitment", "applications"] }),
  });

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {isHrRole ? "Candidate pipeline" : "My assigned candidates"}
        </h2>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as CandidateApplicationStage | "")}
          className="input-field"
        >
          <option value="">All stages</option>
          {STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-4 error-text">{getApiErrorMessage(error, "Could not load applications.")}</p>
      )}
      {assignMutation.isError && (
        <p className="mt-4 error-text">
          {getApiErrorMessage(assignMutation.error, "Could not assign a hiring manager.")}
        </p>
      )}

      {data && (
        <div className="mt-4 overflow-hidden card-table">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="table-head-cell">Candidate</th>
                <th className="table-head-cell">Posting</th>
                <th className="table-head-cell">Stage</th>
                <th className="table-head-cell">Updated</th>
                {isHrRole && <th className="table-head-cell">Hiring manager</th>}
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={isHrRole ? 6 : 5} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    No applications match this filter.
                  </td>
                </tr>
              )}
              {data.items.map((application) => (
                <tr key={application.id} className="row-hover">
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                    {application.candidate.fullName}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {application.jobPosting.title}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={application.stage} />
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {formatDateTime(application.stageUpdatedAt)}
                  </td>
                  {isHrRole && (
                    <td className="px-4 py-3">
                      <select
                        value={application.hiringManager?.id ?? ""}
                        onChange={(e) =>
                          assignMutation.mutate({
                            id: application.id,
                            hiringManagerUserId: e.target.value || null,
                          })
                        }
                        disabled={assignMutation.isPending}
                        className="input-field-inset"
                      >
                        <option value="">Unassigned</option>
                        {hiringManagers?.map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {manager.email}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/recruitment/applications/${application.id}`}
                      className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
