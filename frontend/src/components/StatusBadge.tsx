// Status is reserved and never reused for arbitrary series/category color —
// each key here maps a domain status string to one of a small fixed set of
// badge styles, not an open palette.
const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  PENDING: "bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-300",
  CALCULATED: "bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-300",
  APPROVED: "bg-info-100 text-info-800 dark:bg-info-900/40 dark:text-info-300",
  ACTIVE: "bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300",
  PAID: "bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300",
  REJECTED: "bg-danger-100 text-danger-800 dark:bg-danger-900/40 dark:text-danger-300",
  CANCELLED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  INACTIVE: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  TERMINATED: "bg-danger-100 text-danger-800 dark:bg-danger-900/40 dark:text-danger-300",
  // Sprint 2 — expenses/recruitment statuses, mapped onto the same fixed set.
  SUBMITTED: "bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-300",
  REIMBURSED: "bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300",
  APPLIED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  SCREENING: "bg-info-100 text-info-800 dark:bg-info-900/40 dark:text-info-300",
  INTERVIEW: "bg-info-100 text-info-800 dark:bg-info-900/40 dark:text-info-300",
  OFFER: "bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-300",
  HIRED: "bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300",
  WITHDRAWN: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  SENT: "bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-300",
  ACCEPTED: "bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300",
  DECLINED: "bg-danger-100 text-danger-800 dark:bg-danger-900/40 dark:text-danger-300",
  RESCINDED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  OPEN: "bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300",
  CLOSED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  ARCHIVED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const STATUS_DOT: Record<string, string> = {
  DRAFT: "bg-slate-400 dark:bg-slate-500",
  PENDING: "bg-warning-500 dark:bg-warning-400",
  CALCULATED: "bg-warning-500 dark:bg-warning-400",
  APPROVED: "bg-info-500 dark:bg-info-400",
  ACTIVE: "bg-success-500 dark:bg-success-400",
  PAID: "bg-success-500 dark:bg-success-400",
  REJECTED: "bg-danger-500 dark:bg-danger-400",
  CANCELLED: "bg-slate-400 dark:bg-slate-500",
  INACTIVE: "bg-slate-400 dark:bg-slate-500",
  TERMINATED: "bg-danger-500 dark:bg-danger-400",
};

const FALLBACK_STYLE = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
const FALLBACK_DOT = "bg-slate-400 dark:bg-slate-500";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? FALLBACK_STYLE
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status] ?? FALLBACK_DOT}`} aria-hidden="true" />
      {status}
    </span>
  );
}
