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
      className="space-y-4 card"
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
        <p className="error-text">
          {getApiErrorMessage(createMutation.error, "Could not submit the request.")}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="btn-primary"
        >
          {createMutation.isPending ? "Submitting…" : "Submit request"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="btn-text"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
