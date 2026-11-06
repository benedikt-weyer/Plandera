/**
 * Turns failed backend responses into errors with a message that is fine to
 * show directly in the UI.
 *
 * The backend answers errors with `{ "error": "<category>", "details": "<Variant>: <reason>" }`
 * (see `apps/backend/src/errors.rs`), e.g.
 * `{"error":"Authentication failed","details":"Authentication error: invalid email or password"}`.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const NETWORK_ERROR_MESSAGE =
  "Can't reach the server. Please check your connection and try again.";

const SERVER_ERROR_MESSAGE = 'Something went wrong on the server. Please try again later.';

// The Rust enum's Display prefixes, e.g. "Authentication error: ...".
const DETAILS_PREFIX = /^(?:Authentication error|Validation error|Not found):\s*/i;

function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

export function formatApiErrorMessage(status: number, bodyText: string): string {
  // 5xx details can contain internal information (database errors, etc.).
  if (status >= 500) {
    return SERVER_ERROR_MESSAGE;
  }

  let details: string | undefined;
  let category: string | undefined;
  try {
    const body: unknown = JSON.parse(bodyText);
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      details = typeof record.details === 'string' ? record.details : undefined;
      category = typeof record.error === 'string' ? record.error : undefined;
    }
  } catch {
    // Not JSON (e.g. a proxy error page): fall through to the generic message.
  }

  const reason = details?.replace(DETAILS_PREFIX, '');
  if (reason) {
    return sentence(reason);
  }
  if (category) {
    return sentence(category);
  }
  return `Request failed (HTTP ${status}).`;
}
