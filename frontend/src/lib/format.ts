// Stat-tile value contract: auto-compact (1,284 / 12.9K / $4.2M), proportional
// figures — not tabular-nums, which is reserved for aligned table/axis columns.
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatMoney(value: number, currency = "MMK"): string {
  return `${formatCompactNumber(value)} ${currency}`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(new Date(iso));
}
