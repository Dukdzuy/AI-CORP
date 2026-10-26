/**
 * RFC 4180 CSV writer shared by the audit and project exports. Cells that start with
 * = + - @ are prefixed with ' so a spreadsheet does not run them as formulas (CSV injection).
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: readonly string[], rows: ReadonlyArray<readonly unknown[]>): string {
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
