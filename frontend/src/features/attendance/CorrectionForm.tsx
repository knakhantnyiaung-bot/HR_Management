import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api/client";
import { toDateTimeLocalValue } from "@/lib/format";
import { correctAttendance } from "@/features/attendance/api";
import type { AttendanceRecord } from "@/features/attendance/types";

const correctionSchema = z.object({
  checkIn: z.string().min(1),
  checkOut: z.string().optional().or(z.literal("")),
  reason: z.string().min(1, "A reason is required"),
});

type CorrectionFormValues = z.infer<typeof correctionSchema>;

export function CorrectionForm({
  record,
  onDone,
}: {
  record: AttendanceRecord;
  onDone: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CorrectionFormValues>({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      checkIn: toDateTimeLocalValue(record.checkIn),
      checkOut: record.checkOut ? toDateTimeLocalValue(record.checkOut) : "",
      reason: "",
    },
  });

  const correctMutation = useMutation({
    mutationFn: (values: CorrectionFormValues) =>
      correctAttendance(record.id, {
        checkIn: new Date(values.checkIn).toISOString(),
        checkOut: values.checkOut ? new Date(values.checkOut).toISOString() : undefined,
        reason: values.reason,
      }),
    onSuccess: onDone,
  });

  return (
    <form
      onSubmit={handleSubmit((values) => correctMutation.mutate(values))}
      className="space-y-3 p-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Check in
          </label>
          <input
            type="datetime-local"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            {...register("checkIn")}
          />
          {errors.checkIn && (
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.checkIn.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Check out
          </label>
          <input
            type="datetime-local"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            {...register("checkOut")}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Reason (required)
        </label>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          placeholder="e.g. forgot to check out"
          {...register("reason")}
        />
        {errors.reason && (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.reason.message}</p>
        )}
      </div>

      {correctMutation.isError && (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          {getApiErrorMessage(correctMutation.error, "Could not save the correction.")}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={correctMutation.isPending}
          className="rounded-md bg-indigo-600 transition-colors hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {correctMutation.isPending ? "Saving…" : "Save correction"}
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
