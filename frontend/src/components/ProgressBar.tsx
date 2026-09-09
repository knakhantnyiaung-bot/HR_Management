type Tone = "brand" | "success" | "warning" | "danger" | "info";

const TONE_BAR: Record<Tone, string> = {
  brand: "bg-indigo-500 dark:bg-indigo-400",
  success: "bg-success-500 dark:bg-success-400",
  warning: "bg-warning-500 dark:bg-warning-400",
  danger: "bg-danger-500 dark:bg-danger-400",
  info: "bg-info-500 dark:bg-info-400",
};

interface ProgressBarProps {
  value: number;
  max: number;
  tone?: Tone;
  label?: string;
  valueLabel?: string;
}

export function ProgressBar({ value, max, tone = "brand", label, valueLabel }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div>
      {(label || valueLabel) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          {label && <span className="text-slate-500 dark:text-slate-400">{label}</span>}
          {valueLabel && (
            <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">{valueLabel}</span>
          )}
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${TONE_BAR[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
