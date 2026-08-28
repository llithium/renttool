import { describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

function requestEvent(search: string): Parameters<typeof GET>[0] {
  return {
    url: new URL('http://localhost/api/nearby' + search),
    setHeaders: vi.fn()
  } as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/nearby', () => {
  it('rejects missing and invalid coordinates', async () => {
    await expect(GET(requestEvent('?lat=not-a-number&lng=-74'))).rejects.toMatchObject({
      status: 400
    });
    await expect(GET(requestEvent('?lng=-74'))).rejects.toMatchObject({ status: 400 });
    await expect(GET(requestEvent('?lat=%20&lng=-74'))).rejects.toMatchObject({ status: 400 });
  });

  it('returns the documented bundled nearby-place shape and cache headers', async () => {
    const event = requestEvent('?lat=35.2271&lng=-80.8431&city=Charlotte&state=NC');

    const response = await GET(event);
    const body = await response.json();

    expect(body.nearby.length).toBeGreaterThan(0);
    expect(body.nearby[0]).toEqual({
      label: expect.stringMatching(/, [A-Z]{2}$/),
      city: expect.any(String),
      state: expect.stringMatching(/^[A-Z]{2}$/),
      lat: expect.any(Number),
      lng: expect.any(Number),
      miles: expect.any(Number),
      pop: expect.any(Number)
    });
    expect(event.setHeaders).toHaveBeenCalledWith({
      'Cache-Control': 'public, max-age=86400, s-maxage=2592000'
    });
  });
});
