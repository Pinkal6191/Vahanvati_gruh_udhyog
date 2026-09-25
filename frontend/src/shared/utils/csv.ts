/**
 * RFC 4180 compliant CSV generator and browser download utility with
 * UTF-8 Byte Order Mark (BOM) and OWASP formula injection protection.
 */

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  let sanitized = str;

  // OWASP CSV injection mitigation:
  // If string begins with =, +, -, @ and is not a purely valid number, prefix with '
  if (/^[\t\r ]*[=\+\-@]/.test(sanitized)) {
    if (!/^[+-]?\d+(\.\d+)?$/.test(sanitized.trim())) {
      sanitized = `'${sanitized}`;
    }
  }

  // RFC 4180 escaping: wrap in quotes if contains comma, quote, or newline
  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}

export function buildCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(',');
  const rowLines = rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(','));
  const content = [headerLine, ...rowLines].join('\r\n');
  return `\uFEFF${content}\r\n`;
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
