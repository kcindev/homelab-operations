// Network errors such as ECONNREFUSED can arrive as an AggregateError with an
// empty message, so the error code is included when present.
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  if (error.message.includes(code)) {
    return error.message || error.name;
  }
  return error.message ? `${code}: ${error.message}` : code;
}
