import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { coordinatesFromSearch } from '$lib/geo';

/** Resolve county/state FIPS from coordinates via the FCC Area API (keyless).
 * The FMR endpoint needs FIPS codes; the client already has coords from the
 * autocomplete pick, so this is a single cheap hop. */
export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
  const coordinates = coordinatesFromSearch(url.searchParams);
  if (!coordinates) {
    throw error(400, 'lat and lng are required');
  }
  const [lat, lng] = coordinates;

  const fcc = new URL('https://geo.fcc.gov/api/census/area');
  fcc.searchParams.set('lat', String(lat));
  fcc.searchParams.set('lon', String(lng));
  fcc.searchParams.set('format', 'json');

  try {
    const res = await fetch(fcc.toString(), { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return json({ ok: false });
    const data: unknown = await res.json();
    if (!data || typeof data !== 'object' || !('results' in data) || !Array.isArray(data.results))
      return json({ ok: false });
    const row: unknown = data.results[0];
    if (!row || typeof row !== 'object') return json({ ok: false });
    const r = row as Record<string, unknown>;
    if (typeof r.county_fips !== 'string' || !/^\d{5}$/.test(r.county_fips))
      return json({ ok: false });

    const combined = r.county_fips; // SSCCC
    const stateFips = combined.slice(0, 2);
    const countyFips = combined.slice(2);

    setHeaders({ 'Cache-Control': 'public, max-age=86400, s-maxage=604800' });
    return json({
      ok: true,
      stateFips,
      countyFips,
      combinedFips: combined,
      county: typeof r.county_name === 'string' ? r.county_name : '',
      state: typeof r.state_code === 'string' && /^[A-Z]{2}$/.test(r.state_code) ? r.state_code : ''
    });
  } catch {
    return json({ ok: false });
  }
};
