import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface EmptyStateAction {
  label: string;
  to: string;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center dark:border-slate-800 ${
        compact ? "px-4 py-8" : "px-6 py-12"
      }`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-slate-400 dark:text-slate-500">{description}</p>
      )}
      {action && (
        <Link to={action.to} className="btn-primary mt-4">
          {action.label}
        </Link>
      )}
    </div>
  );
}
