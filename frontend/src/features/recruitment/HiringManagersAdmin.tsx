import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api/client";
import { createHiringManager, listHiringManagers } from "@/features/recruitment/api";

export function HiringManagersAdmin() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [lastTempPassword, setLastTempPassword] = useState<string | null>(null);

  const { data: managers, isLoading, isError, error } = useQuery({
    queryKey: ["recruitment", "hiring-managers"],
    queryFn: listHiringManagers,
  });

  const createMutation = useMutation({
    mutationFn: createHiringManager,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "hiring-managers"] });
      setEmail("");
      setLastTempPassword(result.temporaryPassword ?? null);
    },
  });

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Hiring Managers</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Accounts that can be assigned to a candidate pipeline. Not an employee record — this is a
        login only.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate({ email });
        }}
        className="mt-2 flex items-end gap-3 card"
      >
        <div className="flex-1">
          <label className="label-field">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field-inset w-full"
          />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending || !email.trim()}
          className="btn-primary"
        >
          {createMutation.isPending ? "Creating…" : "Create account"}
        </button>
      </form>
      {createMutation.isError && (
        <p className="mt-2 error-text">
          {getApiErrorMessage(createMutation.error, "Could not create this account.")}
        </p>
      )}
      {lastTempPassword && (
        <p className="mt-2 rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-800 dark:bg-warning-900/40 dark:text-warning-300">
          Temporary password for the new account: <strong>{lastTempPassword}</strong> — share it
          with them securely; it will not be shown again.
        </p>
      )}

      {isLoading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-4 error-text">{getApiErrorMessage(error, "Could not load accounts.")}</p>
      )}

      {managers && (
        <ul className="mt-4 divide-y divide-slate-100 card dark:divide-slate-800">
          {managers.length === 0 && (
            <li className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              No Hiring Manager accounts yet.
            </li>
          )}
          {managers.map((manager) => (
            <li key={manager.id} className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-900 dark:text-slate-100">{manager.email}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{manager.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
