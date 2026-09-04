import { describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

function requestEvent(search: string, fetch = vi.fn()): Parameters<typeof GET>[0] {
  return {
    url: new URL('http://localhost/api/geocode' + search),
    fetch,
    setHeaders: vi.fn()
  } as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/geocode', () => {
  it('rejects missing, malformed, and out-of-range coordinates', async () => {
    await expect(GET(requestEvent('?lat=91&lng=-74'))).rejects.toMatchObject({ status: 400 });
    await expect(GET(requestEvent('?lat=27.9477oops&lng=-82.4584'))).rejects.toMatchObject({
      status: 400
    });
    await expect(GET(requestEvent('?lat=&lng=-82.4584'))).rejects.toMatchObject({ status: 400 });
  });

  it('maps a valid FCC record to five-digit county FIPS', async () => {
    const upstream = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              { county_fips: '12057', county_name: 'Hillsborough County', state_code: 'FL' }
            ]
          })
        )
    );
    const event = requestEvent('?lat=27.9477&lng=-82.4584', upstream);

    const response = await GET(event);

    expect(await response.json()).toEqual({
      ok: true,
      stateFips: '12',
      countyFips: '057',
      combinedFips: '12057',
      county: 'Hillsborough County',
      state: 'FL'
    });
    expect(event.setHeaders).toHaveBeenCalledWith({
      'Cache-Control': 'public, max-age=86400, s-maxage=604800'
    });
  });

  it('does not pass malformed FCC metadata through to the client', async () => {
    const response = await GET(
      requestEvent(
        '?lat=27.9477&lng=-82.4584',
        vi.fn(async () =>
          Response.json({
            results: [
              { county_fips: '12057', county_name: { unexpected: true }, state_code: ['FL'] }
            ]
          })
        )
      )
    );
    expect(await response.json()).toMatchObject({ ok: true, county: '', state: '' });
  });

  it.each([null, { results: {} }, { results: [null] }, { results: [{ county_fips: ['12057'] }] }])(
    'rejects malformed FCC response shapes: %j',
    async (body) => {
      const response = await GET(
        requestEvent(
          '?lat=27.9477&lng=-82.4584',
          vi.fn(async () => Response.json(body))
        )
      );
      expect(await response.json()).toEqual({ ok: false });
    }
  );

  it('returns { ok: false } for malformed and failed upstream responses', async () => {
    const malformed = await GET(
      requestEvent(
        '?lat=27.9477&lng=-82.4584',
        vi.fn(async () => new Response(JSON.stringify({ results: [{ county_fips: '1205' }] })))
      )
    );
    const failed = await GET(
      requestEvent(
        '?lat=27.9477&lng=-82.4584',
        vi.fn(async () => new Response('upstream failure', { status: 503 }))
      )
    );

    expect(await malformed.json()).toEqual({ ok: false });
    expect(await failed.json()).toEqual({ ok: false });
  });
});
