export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text: string;

  if (value instanceof Date) {
    text = value.toISOString();
  } else if (typeof value === 'string') {
    text = value;
  } else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    text = String(value);
  } else if (typeof value === 'symbol') {
    text = value.toString();
  } else if (typeof value === 'function') {
    text = value.name ? `[function ${value.name}]` : '[function]';
  } else if (typeof value === 'object') {
    try {
      text = JSON.stringify(value);
    } catch {
      text = '';
    }
  } else {
    text = '';
  }

  // Escape CSV per RFC 4180-ish:
  // - wrap in quotes if contains quote, comma, or newlines
  // - double inner quotes
  const needsQuotes =
    text.includes('"') ||
    text.includes(',') ||
    text.includes('\n') ||
    text.includes('\r');

  if (!needsQuotes) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
