const RATE_LIMIT_BUFFER_MS = 5_000;
const HOURLY_FALLBACK_MS = 60 * 60 * 1_000;

type HeaderReader = Pick<Headers, 'get'>;

function positiveDelay(timestamp: number, now: number): number | null {
  const delay = timestamp - now;
  return Number.isFinite(delay) && delay >= 0 ? delay : null;
}

function retryAfterDelay(value: string | null, now: number): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : positiveDelay(timestamp, now);
}

function resetDelay(value: string | null, now: number): number | null {
  if (!value) return null;

  const reset = Number(value);
  if (!Number.isFinite(reset) || reset < 0) return null;

  // Rate-limit reset headers conventionally use Unix seconds, but tolerate
  // milliseconds in case an intermediary rewrites the value.
  const timestamp = reset < 10_000_000_000 ? reset * 1_000 : reset;
  return positiveDelay(timestamp, now);
}

export function rateLimitRemaining(headers: HeaderReader): number | null {
  const value = headers.get('x-ratelimit-remaining');
  if (value === null || !/^\d+$/.test(value.trim())) return null;
  return Number(value);
}

export function isRateLimitResponse(status: number, headers: HeaderReader): boolean {
  return status === 429 || (status === 403 && rateLimitRemaining(headers) === 0);
}

export function rateLimitWaitMs(headers: HeaderReader, now = Date.now()): number {
  const delay =
    retryAfterDelay(headers.get('retry-after'), now) ??
    resetDelay(headers.get('x-ratelimit-reset'), now) ??
    HOURLY_FALLBACK_MS;

  return delay + RATE_LIMIT_BUFFER_MS;
}
