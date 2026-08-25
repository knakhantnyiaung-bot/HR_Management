interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
}

// Stat tile contract (label / value / optional hint): label in sentence
// case with no trailing colon, value in the default proportional figures
// (not tabular-nums — that's for aligned table/axis columns, not a
// standalone tile value).
export function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <div className="rounded-lg border border-slate-200 border-l-4 border-l-indigo-500 bg-white p-4 shadow-sm dark:border-slate-800 dark:border-l-indigo-400 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}
