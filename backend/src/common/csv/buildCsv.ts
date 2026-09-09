// BANK-01 — a hand-rolled CSV writer rather than a dependency: RFC 4180
// quoting is a handful of lines, and this is the only place in the repo
// that needs it. Every cell is quoted unconditionally (simpler than
// deciding cell-by-cell whether quoting is required, and still valid CSV).
function escapeCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  // CRLF — the conventional line ending for CSV (RFC 4180), and what most
  // bank portals' bulk-upload parsers expect.
  return lines.join("\r\n") + "\r\n";
}
