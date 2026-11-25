/** Excel can ignore leading whitespace/control characters before a formula token. */
export function spreadsheetText(value: unknown): string {
  const text = String(value ?? '');
  return /^[\s\u0000-\u001f]*[=+\-@]/u.test(text) ? `'${text}` : text;
}
