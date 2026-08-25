import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TextField } from "@/components/form/TextField";
import { getApiErrorMessage } from "@/lib/api/client";
import { createOvertimeRequest } from "@/features/overtime/api";

const requestSchema = z
  .object({
    startTime: z.string().min(1, "Required"),
    endTime: z.string().min(1, "Required"),
    multiplier: z.coerce.number().positive().optional().or(z.literal("")),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

type RequestForm = z.infer<typeof requestSchema>;

export function OvertimeRequestForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestForm>({ resolver: zodResolver(requestSchema) });

  const createMutation = useMutation({
    // workDate isn't its own input — it's naturally the start time's date,
    // so it's derived here instead of asking for a third, redundant field.
    mutationFn: (values: RequestForm) => {
      const startTime = new Date(values.startTime);
      const workDate = `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, "0")}-${String(
        startTime.getDate(),
      ).padStart(2, "0")}`;
      return createOvertimeRequest({
        workDate,
        startTime: startTime.toISOString(),
        endTime: new Date(values.endTime).toISOString(),
        multiplier: values.multiplier || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overtime", "requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "me"] });
      onDone();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => createMutation.mutate(values))}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Start time"
          type="datetime-local"
          registration={register("startTime")}
          error={errors.startTime?.message}
        />
        <TextField
          label="End time"
          type="datetime-local"
          registration={register("endTime")}
          error={errors.endTime?.message}
        />
      </div>
      <TextField
        label="Multiplier (optional — defaults to 1.5x)"
        type="number"
        registration={register("multiplier")}
        error={errors.multiplier?.message as string | undefined}
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
          className="rounded-md bg-indigo-600 transition-colors hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
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
