import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCoordinates,
  fetchNearby,
  fetchPopulation,
  fetchSuggestions,
  lookupRent
} from './api';

afterEach(() => vi.unstubAllGlobals());

describe('API response boundaries', () => {
  it('drops malformed suggestions and handles invalid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          suggestions: [
            { label: 'Good, ZZ', city: 'Good', state: 'ZZ', lat: 40, lng: -74 },
            { label: 'Bad, ZZ', city: 'Bad', state: 'ZZ', lat: 999, lng: 0 },
            { label: 'No coords', city: 'No coords', state: 'ZZ' }
          ]
        })
      }))
    );
    await expect(fetchSuggestions('g')).resolves.toEqual([
      { label: 'Good, ZZ', city: 'Good', state: 'ZZ', lat: 40, lng: -74 },
      { label: 'No coords', city: 'No coords', state: 'ZZ' }
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new Error('bad json');
        }
      }))
    );
    await expect(fetchSuggestions('g')).resolves.toEqual([]);
  });

  it('drops malformed nearby records', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          nearby: [
            {
              label: 'Good, ZZ',
              city: 'Good',
              state: 'ZZ',
              lat: 40,
              lng: -74,
              miles: 2,
              pop: null
            },
            { label: 'Bad, ZZ', city: 'Bad', state: 'ZZ', lat: 40, lng: -74, miles: 2 }
          ]
        })
      }))
    );
    await expect(fetchNearby(40, -74)).resolves.toHaveLength(1);
  });

  it('rejects non-finite population and malformed rent payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, pop: Infinity }) }))
    );
    await expect(fetchPopulation(40, -74)).resolves.toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.includes('/geocode')
            ? { ok: true, stateFips: '01', countyFips: '001' }
            : { ok: true, r1: -100, r2: 'bad' }
      }))
    );
    await expect(lookupRent(40, -74)).resolves.toMatchObject({
      source: 'none',
      r1: null,
      r2: null
    });
  });
});

describe('request failure contracts', () => {
  it.each(['network', 'http', 'json'] as const)(
    'degrades gracefully on %s failure',
    async (failure) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          if (failure === 'network') throw new Error('offline');
          return new Response(failure === 'json' ? '{' : '', {
            status: failure === 'http' ? 503 : 200
          });
        })
      );
      await expect(fetchSuggestions('Tampa')).resolves.toEqual([]);
      await expect(fetchNearby(40, -74)).resolves.toEqual([]);
      await expect(fetchCoordinates('Tampa', 'FL')).resolves.toBeUndefined();
      await expect(fetchPopulation(40, -74)).resolves.toBeNull();
      await expect(lookupRent(40, -74)).resolves.toMatchObject({
        source: 'none',
        r1: null,
        r2: null
      });
    }
  );

  it.each([
    { ok: true, lat: 91, lng: -74 },
    { ok: true, lat: '40', lng: -74 },
    { ok: true, lat: 40 },
    { ok: 'true', lat: 40, lng: -74 }
  ])('rejects invalid coordinate responses: %j', async (body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(body))
    );
    await expect(fetchCoordinates('Example', 'ZZ')).resolves.toBeUndefined();
  });

  it('preserves valid zero coordinates and finite population', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ok: true, lat: 0, lng: 0 }))
      .mockResolvedValueOnce(Response.json({ ok: true, pop: 125000 }));
    vi.stubGlobal('fetch', fetch);
    await expect(fetchCoordinates('Zero', 'ZZ')).resolves.toEqual([0, 0]);
    await expect(fetchPopulation(0, 0)).resolves.toBe(125000);
  });

  it.each([
    { ok: true, stateFips: ['12'], countyFips: '057' },
    { ok: true, stateFips: '12&county=001', countyFips: '057' },
    { ok: 'true', stateFips: '12', countyFips: '057' }
  ])('does not start a rent request for malformed FIPS: %j', async (body) => {
    const fetch = vi.fn(async () => Response.json(body));
    vi.stubGlobal('fetch', fetch);
    await expect(lookupRent(40, -74)).resolves.toMatchObject({ source: 'none' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('maps HUD data and retains valid county provenance when the bundle omits its name', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          stateFips: '12',
          countyFips: '057',
          county: 'Hillsborough County'
        })
      )
      .mockResolvedValueOnce(
        Response.json({ ok: true, r1: 1400, r2: 1700, county: '', year: 'FY2026' })
      );
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    await expect(lookupRent(40, -74, signal)).resolves.toEqual({
      r1: 1400,
      r2: 1700,
      yoy: null,
      source: 'hud-fmr',
      rentMetric: 'fair-market-rent',
      rentArea: 'Hillsborough County area',
      rentYear: 'FY2026'
    });
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/fmr?state=12&county=057', { signal });
  });
});
