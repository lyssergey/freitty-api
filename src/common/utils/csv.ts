/** Characters that make spreadsheet apps evaluate a cell as a formula. */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

export type CsvCell = string | number | null | undefined;

/**
 * One CSV field per RFC 4180 — quoted when it contains a comma, quote or line
 * break, with quotes doubled — after neutralising spreadsheet formula injection
 * (a text cell starting with `= + - @` is prefixed with `'`). Numbers are written
 * as-is, so negative amounts stay numeric.
 */
export function csvField(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  const text = FORMULA_TRIGGERS.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 document: CRLF line endings, header row first. */
export function toCsv(header: readonly string[], rows: ReadonlyArray<readonly CsvCell[]>): string {
  return [header, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}
