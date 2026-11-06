import type { CommuteLocation } from './commute';

let queue: Promise<unknown> = Promise.resolve();
let lastStarted = 0;

/** Space city-specific requests to respect the routing provider's shared burst limit. */
export function requestCommute(
  destination: CommuteLocation,
  origins: CommuteLocation[],
  signal: AbortSignal
): Promise<Response> {
  async function send() {
    signal.throwIfAborted();
    const delay = Math.max(0, lastStarted + 1200 - Date.now());
    if (delay) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(finish, delay);
        function finish() {
          clearTimeout(timer);
          signal.removeEventListener('abort', finish);
          resolve();
        }
        signal.addEventListener('abort', finish, { once: true });
      });
    }
    signal.throwIfAborted();
    lastStarted = Date.now();
    return fetch('/api/commute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, origins }),
      signal
    });
  }
  const request = queue.then(async () => {
    const response = await send();
    // Other browsers can share the server's provider quota.
    return response.status === 429 ? send() : response;
  });
  queue = request.catch(() => undefined);
  return request;
}
