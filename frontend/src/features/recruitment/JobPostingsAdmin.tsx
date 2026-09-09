import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SelectField } from "@/components/form/SelectField";
import { TextField } from "@/components/form/TextField";
import { getApiErrorMessage } from "@/lib/api/client";
import { fetchDepartments, fetchPositions } from "@/features/organization/api";
import {
  createJobPosting,
  listJobPostings,
  updateJobPostingStatus,
} from "@/features/recruitment/api";
import type { JobPostingStatus } from "@/features/recruitment/types";
import { CandidateCreateForm } from "@/features/recruitment/CandidateCreateForm";

const postingSchema = z.object({
  title: z.string().min(1, "Required"),
  departmentId: z.string().min(1, "Required"),
  positionId: z.string().min(1, "Required"),
  employmentType: z.string().min(1, "Required"),
  openings: z.coerce.number().int().positive().default(1),
});

type PostingForm = z.infer<typeof postingSchema>;

const STATUS_OPTIONS: JobPostingStatus[] = ["DRAFT", "OPEN", "CLOSED", "ARCHIVED"];

export function JobPostingsAdmin() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [candidateFormPostingId, setCandidateFormPostingId] = useState<string | null>(null);

  const { data: departments } = useQuery({ queryKey: ["departments", "picker"], queryFn: () => fetchDepartments("ACTIVE") });
  const { data: postings, isLoading, isError, error } = useQuery({
    queryKey: ["recruitment", "postings"],
    queryFn: () => listJobPostings({ page: 1, pageSize: 50 }),
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PostingForm>({ resolver: zodResolver(postingSchema), defaultValues: { openings: 1 } });
  const selectedDepartmentId = watch("departmentId");

  const { data: positions } = useQuery({
    queryKey: ["positions", "picker", selectedDepartmentId],
    queryFn: () => fetchPositions({ departmentId: selectedDepartmentId, status: "ACTIVE" }),
    enabled: Boolean(selectedDepartmentId),
  });

  const createMutation = useMutation({
    mutationFn: createJobPosting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "postings"] });
      reset({ openings: 1 });
      setShowForm(false);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobPostingStatus }) =>
      updateJobPostingStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recruitment", "postings"] }),
  });

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Job postings</h2>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
            New posting
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          className="mt-2 space-y-4 card"
        >
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Title" registration={register("title")} error={errors.title?.message} />
            <TextField
              label="Employment type"
              placeholder="FULL_TIME"
              registration={register("employmentType")}
              error={errors.employmentType?.message}
            />
            <SelectField
              label="Department"
              registration={register("departmentId")}
              options={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
              placeholder="Select a department"
              error={errors.departmentId?.message}
            />
            <SelectField
              label="Position"
              registration={register("positionId")}
              options={(positions ?? []).map((p) => ({ value: p.id, label: p.title }))}
              placeholder="Select a position"
              error={errors.positionId?.message}
            />
            <TextField
              label="Openings"
              type="number"
              registration={register("openings")}
              error={errors.openings?.message}
            />
          </div>

          {createMutation.isError && (
            <p className="error-text">
              {getApiErrorMessage(createMutation.error, "Could not create the posting.")}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? "Creating…" : "Create posting"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-text">
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-4 error-text">{getApiErrorMessage(error, "Could not load postings.")}</p>
      )}

      {postings && (
        <div className="mt-4 overflow-hidden card-table">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="table-head-cell">Title</th>
                <th className="table-head-cell">Type</th>
                <th className="table-head-cell">Openings</th>
                <th className="table-head-cell">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {postings.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    No job postings yet.
                  </td>
                </tr>
              )}
              {postings.items.map((posting) => (
                <tr key={posting.id} className="row-hover">
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{posting.title}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{posting.employmentType}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{posting.openings}</td>
                  <td className="px-4 py-3">
                    <select
                      value={posting.status}
                      onChange={(e) =>
                        statusMutation.mutate({ id: posting.id, status: e.target.value as JobPostingStatus })
                      }
                      disabled={statusMutation.isPending}
                      className="input-field-inset"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setCandidateFormPostingId(
                          candidateFormPostingId === posting.id ? null : posting.id,
                        )
                      }
                      className="btn-text hover:underline"
                    >
                      Add candidate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {candidateFormPostingId && (
        <div className="mt-4">
          <CandidateCreateForm
            jobPostingId={candidateFormPostingId}
            onDone={() => setCandidateFormPostingId(null)}
          />
        </div>
      )}
    </section>
  );
}
