import { describe, expect, it } from 'vitest';
import { isRateLimitResponse, rateLimitRemaining, rateLimitWaitMs } from './unsplash-rate-limit';

const NOW = Date.parse('2026-08-30T12:00:00Z');

describe('Unsplash rate-limit handling', () => {
  it('reads the remaining request count', () => {
    expect(rateLimitRemaining(new Headers({ 'X-Ratelimit-Remaining': '49' }))).toBe(49);
    expect(rateLimitRemaining(new Headers())).toBeNull();
  });

  it('recognizes a 429 or an exhausted quota as rate limiting', () => {
    expect(isRateLimitResponse(429, new Headers())).toBe(true);
    expect(isRateLimitResponse(403, new Headers({ 'X-Ratelimit-Remaining': '0' }))).toBe(true);
    expect(isRateLimitResponse(403, new Headers())).toBe(false);
    expect(isRateLimitResponse(200, new Headers({ 'X-Ratelimit-Remaining': '0' }))).toBe(false);
  });

  it('prefers Retry-After seconds and includes a reset buffer', () => {
    expect(rateLimitWaitMs(new Headers({ 'Retry-After': '120' }), NOW)).toBe(125_000);
  });

  it('accepts an HTTP date in Retry-After', () => {
    expect(
      rateLimitWaitMs(new Headers({ 'Retry-After': 'Sun, 30 Aug 2026 12:02:00 GMT' }), NOW)
    ).toBe(125_000);
  });

  it('uses a Unix reset timestamp when supplied', () => {
    const resetSeconds = (NOW + 90_000) / 1_000;
    expect(rateLimitWaitMs(new Headers({ 'X-Ratelimit-Reset': String(resetSeconds) }), NOW)).toBe(
      95_000
    );
  });

  it('falls back to one hour when Unsplash supplies no reset time', () => {
    expect(rateLimitWaitMs(new Headers(), NOW)).toBe(3_605_000);
  });
});
