import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TextField } from "@/components/form/TextField";
import { getApiErrorMessage } from "@/lib/api/client";
import { createLeaveType, listLeaveTypes } from "@/features/leave/api";

const typeSchema = z.object({
  name: z.string().min(1, "Required"),
  paid: z.boolean(),
});

type TypeForm = z.infer<typeof typeSchema>;

export function LeaveTypesAdmin() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TypeForm>({ resolver: zodResolver(typeSchema), defaultValues: { paid: true } });

  const { data: leaveTypes, isLoading } = useQuery({
    queryKey: ["leave", "types"],
    queryFn: listLeaveTypes,
  });

  const createMutation = useMutation({
    mutationFn: createLeaveType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave", "types"] });
      reset({ name: "", paid: true });
      setShowForm(false);
    },
  });

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Leave types</h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-text"
          >
            New type
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          className="mt-2 flex items-end gap-3 card"
        >
          <div className="flex-1">
            <TextField label="Name" registration={register("name")} error={errors.name?.message} />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" {...register("paid")} />
            Paid
          </label>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn-primary"
          >
            {createMutation.isPending ? "Saving…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="btn-text"
          >
            Cancel
          </button>
        </form>
      )}
      {createMutation.isError && (
        <p className="mt-2 error-text">
          {getApiErrorMessage(createMutation.error, "Could not create the leave type.")}
        </p>
      )}

      {isLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {leaveTypes && (
        <ul className="mt-2 card-table divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {leaveTypes.length === 0 && (
            <li className="px-4 py-3 text-slate-400 dark:text-slate-500">No leave types yet.</li>
          )}
          {leaveTypes.map((type) => (
            <li key={type.id} className="flex items-center justify-between px-4 py-2">
              <span className="text-slate-900 dark:text-slate-100">{type.name}</span>
              <span className="text-slate-500 dark:text-slate-400">
                {type.paid ? "Paid" : "Unpaid"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
