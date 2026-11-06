import { afterEach, expect, it, vi } from 'vitest';

const location = { lat: 40, lng: -74 };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('spaces five city requests and retries a shared provider quota response', async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(10000);
  const started: number[] = [];
  const fetch = vi.fn(async () => {
    started.push(Date.now());
    return new Response('{}', { status: started.length === 1 ? 429 : 200 });
  });
  vi.stubGlobal('fetch', fetch);
  const { requestCommute } = await import('./commuteRouting');
  const requests = Array.from({ length: 5 }, () =>
    requestCommute(location, [location], new AbortController().signal)
  );
  await vi.runAllTimersAsync();
  expect((await Promise.all(requests)).map((response) => response.status)).toEqual([
    200, 200, 200, 200, 200
  ]);
  expect(started).toEqual([10000, 11200, 12400, 13600, 14800, 16000]);
});

it('skips cancelled cities and continues after a failed request', async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(10000);
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('Offline'))
    .mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  const { requestCommute } = await import('./commuteRouting');
  const controller = new AbortController();
  const requests = [
    requestCommute(location, [location], new AbortController().signal),
    requestCommute(location, [location], controller.signal),
    requestCommute(location, [location], new AbortController().signal)
  ];
  const settled = Promise.allSettled(requests);
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  await vi.runAllTimersAsync();
  expect((await settled).map((result) => result.status)).toEqual([
    'rejected',
    'rejected',
    'fulfilled'
  ]);
  expect(fetch).toHaveBeenCalledTimes(2);
});
