import type { CitySuggestion, LookupResult, NearbyPlace } from '$lib/types';

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function coordinatePair(lat: unknown, lng: unknown): readonly [number, number] | undefined {
  return typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
    ? [lat, lng]
    : undefined;
}

function suggestion(value: unknown): CitySuggestion | null {
  const item = record(value);
  if (
    !item ||
    typeof item.city !== 'string' ||
    !item.city.trim() ||
    typeof item.state !== 'string' ||
    !/^[A-Z]{2}$/.test(item.state) ||
    typeof item.label !== 'string' ||
    !item.label.trim()
  )
    return null;
  const coordinates = coordinatePair(item.lat, item.lng);
  if (!coordinates && (item.lat != null || item.lng != null)) return null;
  return {
    label: item.label.trim(),
    city: item.city.trim(),
    state: item.state,
    ...(coordinates ? { lat: coordinates[0], lng: coordinates[1] } : {})
  };
}

/** Client response boundaries return absence values when a request or payload is unusable. */

export async function fetchSuggestions(q: string, signal?: AbortSignal): Promise<CitySuggestion[]> {
  try {
    const res = await fetch(`/api/city-suggest?q=${encodeURIComponent(q)}`, { signal });
    if (!res.ok) return [];
    const data = record(await res.json());
    if (!Array.isArray(data?.suggestions)) return [];
    return data.suggestions.map(suggestion).filter((item): item is CitySuggestion => item !== null);
  } catch {
    return [];
  }
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
    const data = record(await res.json());
    return data?.ok === true && finitePositive(data.pop) ? data.pop : null;
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
    const data = record(await res.json());
    return data?.ok === true ? coordinatePair(data.lat, data.lng) : undefined;
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
    const data = record(await res.json());
    if (!Array.isArray(data?.nearby)) return [];
    const nearby: NearbyPlace[] = [];
    for (const value of data.nearby) {
      const item = record(value);
      const place = suggestion(value);
      if (
        !item ||
        !place ||
        place.lat == null ||
        place.lng == null ||
        typeof item.miles !== 'number' ||
        !Number.isFinite(item.miles) ||
        item.miles < 0 ||
        (item.pop !== null && !finitePositive(item.pop))
      )
        continue;
      nearby.push({ ...place, lat: place.lat, lng: place.lng, miles: item.miles, pop: item.pop });
    }
    return nearby;
  } catch {
    return [];
  }
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
    const geo = geoRes.ok ? record(await geoRes.json()) : null;
    if (
      geo?.ok !== true ||
      typeof geo.stateFips !== 'string' ||
      !/^\d{2}$/.test(geo.stateFips) ||
      typeof geo.countyFips !== 'string' ||
      !/^\d{3}$/.test(geo.countyFips)
    )
      return empty;

    const fipsQ = `state=${geo.stateFips}&county=${geo.countyFips}`;

    const fmrRes = await fetch(`/api/fmr?${fipsQ}`, { signal });
    const fmr = fmrRes.ok ? record(await fmrRes.json()) : null;

    if (fmr?.ok === true && (finitePositive(fmr.r1) || finitePositive(fmr.r2))) {
      const county =
        typeof fmr.county === 'string' && fmr.county
          ? fmr.county
          : typeof geo.county === 'string'
            ? geo.county
            : '';
      return {
        r1: finitePositive(fmr.r1) ? fmr.r1 : null,
        r2: finitePositive(fmr.r2) ? fmr.r2 : null,
        yoy: null,
        source: 'hud-fmr',
        rentMetric: 'fair-market-rent',
        rentArea: county ? `${county} area` : 'resolved county area',
        rentYear:
          typeof fmr.year === 'string' ||
          (typeof fmr.year === 'number' && Number.isFinite(fmr.year))
            ? String(fmr.year)
            : ''
      };
    }
    return empty;
  } catch {
    return empty;
  }
}
