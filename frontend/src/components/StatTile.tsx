import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { ProgressBar } from "@/components/ProgressBar";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-slate-900 dark:text-slate-100",
  brand: "text-indigo-600 dark:text-indigo-400",
  success: "text-success-600 dark:text-success-400",
  warning: "text-warning-600 dark:text-warning-400",
  danger: "text-danger-600 dark:text-danger-400",
  info: "text-info-600 dark:text-info-400",
};

const TONE_ICON_WRAP: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  brand: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  success: "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400",
  warning: "bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400",
  danger: "bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400",
  info: "bg-info-50 text-info-600 dark:bg-info-500/10 dark:text-info-400",
};

interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  /** Renders the left accent stripe. Reserve this for cards that need action/attention. */
  attention?: boolean;
  trend?: { value: number; label?: string };
  progress?: { value: number; max: number };
}

// Stat tile contract (label / value / optional hint): label in sentence
// case with no trailing colon, value in the default proportional figures
// (not tabular-nums — that's for aligned table/axis columns, not a
// standalone tile value). The accent stripe (`attention`) is reserved for
// cards representing something awaiting action, e.g. a nonzero pending count.
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  attention,
  trend,
  progress,
}: StatTileProps) {
  return (
    <div className={`card ${attention ? "card-attention" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {Icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_ICON_WRAP[tone]}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className={`mt-2 text-3xl font-bold tracking-tight [font-variant-numeric:tabular-nums] ${TONE_TEXT[tone]}`}>
        {value}
      </p>
      {(hint || trend) && (
        <div className="mt-1.5 flex items-center gap-2">
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                trend.value >= 0
                  ? "text-success-600 dark:text-success-400"
                  : "text-danger-600 dark:text-danger-400"
              }`}
            >
              {trend.value >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {Math.abs(trend.value)}
              {trend.label ? ` ${trend.label}` : ""}
            </span>
          )}
          {hint && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
        </div>
      )}
      {progress && (
        <div className="mt-3">
          <ProgressBar value={progress.value} max={progress.max} tone={tone === "neutral" ? "brand" : tone} />
        </div>
      )}
    </div>
  );
}
