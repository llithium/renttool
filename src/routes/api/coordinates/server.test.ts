import { describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

function requestEvent(search: string): Parameters<typeof GET>[0] {
  return {
    url: new URL('http://localhost/api/coordinates' + search),
    setHeaders: vi.fn()
  } as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/coordinates', () => {
  it('rejects missing or malformed place identity', async () => {
    await expect(GET(requestEvent('?city=Lansing&state=Michigan'))).rejects.toMatchObject({
      status: 400
    });
    await expect(GET(requestEvent('?state=MI'))).rejects.toMatchObject({ status: 400 });
  });

  it('returns exact bundled coordinates with cache headers', async () => {
    const event = requestEvent('?city=Lansing&state=mi');

    const response = await GET(event);

    expect(await response.json()).toEqual({ ok: true, lat: 42.7142, lng: -84.5601 });
    expect(event.setHeaders).toHaveBeenCalledWith({
      'Cache-Control': 'public, max-age=86400, s-maxage=2592000'
    });
  });

  it('returns { ok: false } when the place is not bundled', async () => {
    const response = await GET(requestEvent('?city=Not%20A%20Place&state=ZZ'));

    expect(await response.json()).toEqual({ ok: false });
  });
});
