import type { CitySuggestion, LookupResult, NearbyPlace, RentSource } from '$lib/types';

/** Typed client wrappers for the /api endpoints. All degrade gracefully. */

export async function fetchSuggestions(q: string, signal?: AbortSignal): Promise<CitySuggestion[]> {
  const res = await fetch(`/api/city-suggest?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return data.suggestions ?? [];
}

/** Population of the place at the given coordinates. Returns null on failure. */
export async function fetchPopulation(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<number | null> {
  try {
    const res = await fetch(`/api/population?lat=${lat}&lng=${lng}`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ok && typeof data.pop === 'number' && data.pop > 0 ? data.pop : null;
  } catch {
    return null;
  }
}

/** Coordinates for an exact bundled city/state match. Keeping this lookup on
 * the server avoids shipping the full US places dataset to the browser when a
 * restored rent city is missing curated coordinates. */
export async function fetchCoordinates(
  city: string,
  state: string,
  signal?: AbortSignal
): Promise<readonly [number, number] | undefined> {
  try {
    const params = new URLSearchParams({ city, state });
    const res = await fetch(`/api/coordinates?${params}`, { signal });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.ok && typeof data.lat === 'number' && typeof data.lng === 'number'
      ? [data.lat, data.lng]
      : undefined;
  } catch {
    return undefined;
  }
}

/** Nearby towns & suburbs around a point, from the bundled US places dataset.
 * `city`/`state` identify the origin so it's excluded from its own list.
 * Returns [] on failure. */
export async function fetchNearby(
  lat: number,
  lng: number,
  city?: string,
  state?: string,
  signal?: AbortSignal
): Promise<NearbyPlace[]> {
  try {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (city) params.set('city', city);
    if (state) params.set('state', state);
    const res = await fetch(`/api/nearby?${params}`, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.nearby) ? data.nearby : [];
  } catch {
    return [];
  }
}

interface GeoResult {
  ok: boolean;
  stateFips?: string;
  countyFips?: string;
  county?: string;
  state?: string;
}

/** Look up bundled HUD Fair Market Rent for an off-list city. */
export async function lookupRent(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<LookupResult> {
  const empty: LookupResult = {
    r1: null,
    r2: null,
    yoy: null,
    source: 'none',
    rentMetric: 'unknown',
    rentArea: '',
    rentYear: ''
  };
  try {
    const geoRes = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`, { signal });
    const geo: GeoResult = geoRes.ok ? await geoRes.json() : { ok: false };
    if (!geo.ok || !geo.stateFips || !geo.countyFips) return empty;

    const fipsQ = `state=${geo.stateFips}&county=${geo.countyFips}`;

    const fmrRes = await fetch(`/api/fmr?${fipsQ}`, { signal });
    const fmr = fmrRes.ok ? await fmrRes.json() : { ok: false };

    if (fmr.ok && (fmr.r1 || fmr.r2)) {
      const county = fmr.county || geo.county || '';
      return {
        r1: fmr.r1,
        r2: fmr.r2,
        yoy: null,
        source: 'hud-fmr' as RentSource,
        rentMetric: 'fair-market-rent',
        rentArea: county ? `${county} area` : 'resolved county area',
        rentYear: String(fmr.year ?? '')
      };
    }
    return empty;
  } catch {
    return empty;
  }
}
