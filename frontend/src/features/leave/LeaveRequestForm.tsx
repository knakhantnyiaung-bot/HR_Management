import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SelectField } from "@/components/form/SelectField";
import { TextField } from "@/components/form/TextField";
import { getApiErrorMessage } from "@/lib/api/client";
import { createLeaveRequest, listLeaveTypes } from "@/features/leave/api";

const requestSchema = z
  .object({
    leaveTypeId: z.string().uuid("Select a leave type"),
    startDate: z.string().min(1, "Required"),
    endDate: z.string().min(1, "Required"),
    reason: z.string().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

type RequestForm = z.infer<typeof requestSchema>;

export function LeaveRequestForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestForm>({ resolver: zodResolver(requestSchema) });

  const { data: leaveTypes } = useQuery({ queryKey: ["leave", "types"], queryFn: listLeaveTypes });

  const createMutation = useMutation({
    // The backend's `reason` is optional but, when present, must be
    // non-empty (min(1)) — an empty string from a blank input fails that,
    // so an untouched field has to be omitted entirely, not sent as "".
    mutationFn: (values: RequestForm) =>
      createLeaveRequest({ ...values, reason: values.reason || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave", "requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "me"] });
      onDone();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => createMutation.mutate(values))}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <SelectField
        label="Leave type"
        registration={register("leaveTypeId")}
        placeholder="Select a leave type"
        options={(leaveTypes ?? []).map((t) => ({
          value: t.id,
          label: `${t.name}${t.paid ? "" : " (unpaid)"}`,
        }))}
        error={errors.leaveTypeId?.message}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Start date"
          type="date"
          registration={register("startDate")}
          error={errors.startDate?.message}
        />
        <TextField
          label="End date"
          type="date"
          registration={register("endDate")}
          error={errors.endDate?.message}
        />
      </div>
      <TextField
        label="Reason (optional)"
        registration={register("reason")}
        error={errors.reason?.message}
      />

      {createMutation.isError && (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(createMutation.error, "Could not submit the request.")}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-md bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {createMutation.isPending ? "Submitting…" : "Submit request"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-slate-500 hover:underline dark:text-slate-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
