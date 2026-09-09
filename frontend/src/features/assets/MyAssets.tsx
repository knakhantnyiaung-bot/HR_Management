import { useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api/client";
import { listAssets } from "@/features/assets/api";

// ASSET-06 — the backend already scopes an Employee requester to their own
// currently-assigned assets (assets.service.ts), so this list needs no
// employeeId param — unlike expenses, which still take one explicitly.
export function MyAssets() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["assets", "mine"],
    queryFn: () => listAssets({ page: 1, pageSize: 50 }),
  });

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">My assets</h2>

      {isLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && (
        <p className="mt-2 error-text">{getApiErrorMessage(error, "Could not load your assets.")}</p>
      )}

      {data && (
        <ul className="mt-2 divide-y divide-slate-100 card dark:divide-slate-800">
          {data.items.length === 0 && (
            <li className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              No assets currently assigned to you.
            </li>
          )}
          {data.items.map((asset) => (
            <li key={asset.id} className="py-3">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{asset.name}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {asset.assetTag} · {asset.category}
                {asset.serialNumber && ` · SN: ${asset.serialNumber}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
