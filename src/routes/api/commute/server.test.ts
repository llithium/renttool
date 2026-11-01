import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
vi.mock('$env/dynamic/private', () => ({ env: {} }));
const destination = { lat: 41, lng: -87 };
const origins = [
  { lat: 42, lng: -88 },
  { lat: 43, lng: -89 }
];
function event(
  body: unknown,
  fetch = vi.fn(async () => Response.json({ code: 'Ok', durations: [[1801], [null]] }))
) {
  return {
    request: new Request('http://localhost/api/commute', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    fetch,
    setHeaders: vi.fn()
  } as unknown as Parameters<typeof POST>[0];
}
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);
});
describe('commute endpoint', () => {
  it('requests city-to-work routes in one batch, with no fallback estimates or caching', async () => {
    const request = event({ destination, origins });
    expect(await (await POST(request)).json()).toEqual({ minutes: [31, null] });
    const url = new URL(vi.mocked(request.fetch).mock.calls[0][0].toString());
    expect(url.pathname).toContain('-87,41;-88,42;-89,43');
    expect(url.searchParams.get('sources')).toBe('1;2');
    expect(url.searchParams.get('destinations')).toBe('0');
    expect(url.searchParams.has('fallback_speed')).toBe(false);
    expect(request.setHeaders).toHaveBeenCalledWith({ 'Cache-Control': 'no-store' });
  });
  it('rejects oversized origin batches before calling the provider', async () => {
    const request = event({ destination, origins: Array(9).fill(destination) });
    await expect(POST(request)).rejects.toMatchObject({ status: 400 });
    expect(request.fetch).not.toHaveBeenCalled();
  });
  it('reports provider failure instead of returning an empty successful result', async () => {
    await expect(
      POST(
        event(
          { destination, origins },
          vi.fn(async () => new Response('', { status: 503 }))
        )
      )
    ).rejects.toMatchObject({ status: 502 });
  });
  it('rejects bursts to the public routing provider', async () => {
    await POST(event({ destination, origins }));
    await expect(POST(event({ destination, origins }))).rejects.toMatchObject({ status: 429 });
  });
});
