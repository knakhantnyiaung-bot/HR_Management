import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TextField } from "@/components/form/TextField";
import { getApiErrorMessage } from "@/lib/api/client";
import { createCandidate } from "@/features/recruitment/api";

const candidateSchema = z.object({
  fullName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  source: z.string().optional(),
});

type CandidateForm = z.infer<typeof candidateSchema>;

export function CandidateCreateForm({
  jobPostingId,
  onDone,
}: {
  jobPostingId: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CandidateForm>({ resolver: zodResolver(candidateSchema) });

  const createMutation = useMutation({
    mutationFn: (values: CandidateForm) =>
      createCandidate(jobPostingId, { ...values, resume: resumeFile ?? undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "applications"] });
      onDone();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => createMutation.mutate(values))}
      className="space-y-4 card"
    >
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add candidate</p>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Full name" registration={register("fullName")} error={errors.fullName?.message} />
        <TextField label="Email" registration={register("email")} error={errors.email?.message} />
        <TextField label="Phone (optional)" registration={register("phone")} error={errors.phone?.message} />
        <TextField label="Source (optional)" registration={register("source")} error={errors.source?.message} />
      </div>

      <div>
        <label className="label-field">Resume (optional — PDF, JPEG, or PNG)</label>
        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm text-slate-600 dark:text-slate-300"
        />
      </div>

      {createMutation.isError && (
        <p className="error-text">
          {getApiErrorMessage(createMutation.error, "Could not add this candidate.")}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={createMutation.isPending} className="btn-primary">
          {createMutation.isPending ? "Adding…" : "Add candidate"}
        </button>
        <button type="button" onClick={onDone} className="btn-text">
          Cancel
        </button>
      </div>
    </form>
  );
}
