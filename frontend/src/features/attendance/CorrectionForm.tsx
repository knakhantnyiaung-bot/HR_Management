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
          <label className="label-field">Check in</label>
          <input type="datetime-local" className="input-field-inset w-full" {...register("checkIn")} />
          {errors.checkIn && <p className="field-error-text">{errors.checkIn.message}</p>}
        </div>
        <div>
          <label className="label-field">Check out</label>
          <input type="datetime-local" className="input-field-inset w-full" {...register("checkOut")} />
        </div>
      </div>
      <div>
        <label className="label-field">Reason (required)</label>
        <input
          className="input-field-inset w-full"
          placeholder="e.g. forgot to check out"
          {...register("reason")}
        />
        {errors.reason && <p className="field-error-text">{errors.reason.message}</p>}
      </div>

      {correctMutation.isError && (
        <p className="error-text">{getApiErrorMessage(correctMutation.error, "Could not save the correction.")}</p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={correctMutation.isPending} className="btn-primary">
          {correctMutation.isPending ? "Saving…" : "Save correction"}
        </button>
        <button type="button" onClick={onDone} className="btn-text">
          Cancel
        </button>
      </div>
    </form>
  );
}
