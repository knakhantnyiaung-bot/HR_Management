import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SelectField } from "@/components/form/SelectField";
import { TextField } from "@/components/form/TextField";
import { getApiErrorMessage } from "@/lib/api/client";
import { createExpenseClaim, listExpenseCategories } from "@/features/expenses/api";

const claimSchema = z.object({
  categoryId: z.string().min(1, "Required"),
  amount: z.coerce.number().positive("Must be greater than zero"),
  expenseDate: z.string().min(1, "Required"),
  description: z.string().optional(),
});

type ClaimForm = z.infer<typeof claimSchema>;

export function ExpenseClaimForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { data: categories } = useQuery({
    queryKey: ["expenses", "categories"],
    queryFn: listExpenseCategories,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClaimForm>({ resolver: zodResolver(claimSchema) });

  const createMutation = useMutation({
    mutationFn: (values: ClaimForm) =>
      createExpenseClaim({ ...values, description: values.description || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", "claims"] });
      onDone();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => createMutation.mutate(values))}
      className="space-y-4 card"
    >
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Category"
          registration={register("categoryId")}
          options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Select a category"
          error={errors.categoryId?.message}
        />
        <TextField
          label="Amount"
          type="number"
          registration={register("amount")}
          error={errors.amount?.message}
        />
        <TextField
          label="Expense date"
          type="date"
          registration={register("expenseDate")}
          error={errors.expenseDate?.message}
        />
        <TextField
          label="Description (optional)"
          registration={register("description")}
          error={errors.description?.message}
        />
      </div>

      {createMutation.isError && (
        <p className="error-text">
          {getApiErrorMessage(createMutation.error, "Could not create the claim.")}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={createMutation.isPending} className="btn-primary">
          {createMutation.isPending ? "Creating…" : "Create claim"}
        </button>
        <button type="button" onClick={onDone} className="btn-text">
          Cancel
        </button>
      </div>
    </form>
  );
}
