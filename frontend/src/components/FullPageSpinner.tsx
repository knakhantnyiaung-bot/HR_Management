export function FullPageSpinner() {
  return (
    <div className="app-shell flex min-h-screen items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
