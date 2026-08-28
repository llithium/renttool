import { describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

function requestEvent(search: string): Parameters<typeof GET>[0] {
  return {
    url: new URL('http://localhost/api/population' + search),
    setHeaders: vi.fn()
  } as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/population', () => {
  it('rejects missing and invalid coordinates', async () => {
    await expect(GET(requestEvent('?lat=35&lng=-181'))).rejects.toMatchObject({ status: 400 });
    await expect(GET(requestEvent('?lat=35'))).rejects.toMatchObject({ status: 400 });
    await expect(GET(requestEvent('?lat=35&lng='))).rejects.toMatchObject({ status: 400 });
  });

  it('returns the documented bundled population shape and cache headers', async () => {
    const event = requestEvent('?lat=35.2271&lng=-80.8431');

    const response = await GET(event);

    expect(await response.json()).toEqual({
      ok: true,
      pop: expect.any(Number),
      name: 'Charlotte',
      source: 'simplemaps'
    });
    expect(event.setHeaders).toHaveBeenCalledWith({
      'Cache-Control': 'public, max-age=86400, s-maxage=2592000'
    });
  });

  it('returns { ok: false } for an ocean coordinate', async () => {
    const response = await GET(requestEvent('?lat=35&lng=-140'));

    expect(await response.json()).toEqual({ ok: false });
  });
});
