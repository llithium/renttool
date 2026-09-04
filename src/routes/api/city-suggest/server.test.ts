import { describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

function requestEvent(search: string, fetch = vi.fn()): Parameters<typeof GET>[0] {
  return {
    url: new URL('http://localhost/api/city-suggest' + search),
    fetch,
    setHeaders: vi.fn()
  } as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/city-suggest', () => {
  it('returns no suggestions without calling Photon for short queries', async () => {
    const upstream = vi.fn();

    const response = await GET(requestEvent('?q=a', upstream));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ suggestions: [] });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('rejects queries longer than 100 characters', async () => {
    await expect(GET(requestEvent('?q=' + 'a'.repeat(101)))).rejects.toMatchObject({ status: 400 });
  });

  it('filters and deduplicates valid US place results and sets cache headers', async () => {
    const upstream = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            features: [
              {
                properties: {
                  countrycode: 'US',
                  osm_key: 'place',
                  osm_value: 'city',
                  name: 'Tampa',
                  state: 'Florida'
                },
                geometry: { coordinates: [-82.4584, 27.9477] }
              },
              {
                properties: {
                  countrycode: 'US',
                  osm_key: 'place',
                  osm_value: 'city',
                  name: 'Tampa',
                  state: 'Florida'
                },
                geometry: { coordinates: [-82.4584, 27.9477] }
              },
              {
                properties: {
                  countrycode: 'CA',
                  osm_key: 'place',
                  osm_value: 'city',
                  name: 'Toronto',
                  state: 'Ontario'
                },
                geometry: { coordinates: [-79.3832, 43.6532] }
              },
              {
                properties: {
                  countrycode: 'US',
                  osm_key: 'highway',
                  osm_value: 'city',
                  name: 'Not a place',
                  state: 'Florida'
                },
                geometry: { coordinates: [-82.4, 27.9] }
              },
              {
                properties: {
                  countrycode: 'US',
                  osm_key: 'place',
                  osm_value: 'city',
                  name: '<unsafe>',
                  state: 'Florida'
                },
                geometry: { coordinates: [-82.4, 27.9] }
              },
              {
                properties: {
                  countrycode: 'US',
                  osm_key: 'place',
                  osm_value: 'city',
                  name: 'St. Petersburg',
                  state: 'Florida'
                },
                geometry: { coordinates: [-300, 91] }
              },
              {
                properties: {
                  countrycode: 'US',
                  osm_key: 'place',
                  osm_value: 'city',
                  name: 'St. Petersburg',
                  state: 'Florida'
                },
                geometry: { coordinates: [-82.68, 27.77] }
              }
            ]
          })
        )
    );
    const event = requestEvent('?q=tampa', upstream);

    const response = await GET(event);

    expect(await response.json()).toEqual({
      suggestions: [
        { label: 'Tampa, FL', city: 'Tampa', state: 'FL', lat: 27.9477, lng: -82.4584 },
        {
          label: 'St. Petersburg, FL',
          city: 'St. Petersburg',
          state: 'FL',
          lat: 27.77,
          lng: -82.68
        }
      ]
    });
    expect(event.setHeaders).toHaveBeenCalledWith({
      'Cache-Control': 'public, max-age=60, s-maxage=300'
    });
  });

  it('skips malformed features without dropping later valid suggestions', async () => {
    const response = await GET(
      requestEvent(
        '?q=tampa',
        vi.fn(async () =>
          Response.json({
            features: [
              null,
              12,
              {
                properties: {
                  countrycode: 'US',
                  osm_key: 'place',
                  osm_value: 'city',
                  name: 'Bad geometry',
                  state: 'FL'
                },
                geometry: { coordinates: {} }
              },
              {
                properties: {
                  countrycode: 'US',
                  osm_key: 'place',
                  osm_value: 'city',
                  name: 'Tampa',
                  state: 'FL'
                },
                geometry: { coordinates: [-82.4584, 27.9477] }
              }
            ]
          })
        )
      )
    );
    expect(await response.json()).toEqual({
      suggestions: [{ label: 'Tampa, FL', city: 'Tampa', state: 'FL', lat: 27.9477, lng: -82.4584 }]
    });
  });

  it('returns an empty list when Photon fails', async () => {
    const response = await GET(
      requestEvent(
        '?q=tampa',
        vi.fn(async () => new Response('upstream failure', { status: 503 }))
      )
    );

    expect(await response.json()).toEqual({ suggestions: [] });
  });
});
