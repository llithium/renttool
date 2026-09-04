import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { STATE_ABBR, VALID_STATES } from '$lib/data/states';
import type { CitySuggestion } from '$lib/types';

/** Autocomplete proxy over Photon (keyless OSM typeahead). Filters to US cities/towns
 * and returns "City, ST" + coordinates so a pick can feed the map without re-geocoding. */
export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2) return json({ suggestions: [] });
  if (q.length > 100) throw error(400, 'q must be 100 characters or fewer');

  const photon = new URL('https://photon.komoot.io/api/');
  photon.searchParams.set('q', q);
  photon.searchParams.set('limit', '12');
  photon.searchParams.set('lang', 'en');

  try {
    const res = await fetch(photon.toString(), {
      headers: { 'User-Agent': 'rent-tool/1.0 (city autocomplete)' },
      signal: AbortSignal.timeout(5_000)
    });
    if (!res.ok) return json({ suggestions: [] });
    const data: unknown = await res.json();
    if (!data || typeof data !== 'object' || !('features' in data) || !Array.isArray(data.features))
      return json({ suggestions: [] });

    const seen = new Set<string>();
    const suggestions: CitySuggestion[] = [];

    for (const feature of data.features) {
      if (!feature || typeof feature !== 'object') continue;
      const f = feature as Record<string, unknown>;
      if (!f.properties || typeof f.properties !== 'object') continue;
      const p = f.properties as Record<string, unknown>;
      if (p.countrycode !== 'US') continue;
      if (p.osm_key !== 'place') continue;
      if (typeof p.osm_value !== 'string' || !['city', 'town', 'village'].includes(p.osm_value))
        continue;

      const cityName = typeof p.name === 'string' ? p.name.trim().slice(0, 80) : '';
      const stateAbbr =
        typeof p.state === 'string'
          ? STATE_ABBR[p.state] || (VALID_STATES.has(p.state) ? p.state : '')
          : '';
      if (!cityName || !stateAbbr || /[<>]/.test(cityName)) continue;

      const label = `${cityName}, ${stateAbbr}`;
      if (seen.has(label)) continue;

      const geometry = f.geometry;
      if (
        !geometry ||
        typeof geometry !== 'object' ||
        !('coordinates' in geometry) ||
        !Array.isArray(geometry.coordinates)
      )
        continue;
      const [lng, lat] = geometry.coordinates;
      if (
        typeof lat !== 'number' ||
        typeof lng !== 'number' ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        continue;
      }

      seen.add(label);
      suggestions.push({ label, city: cityName, state: stateAbbr, lat, lng });
      if (suggestions.length >= 8) break;
    }

    // Cache identical typeahead queries briefly at the edge.
    setHeaders({ 'Cache-Control': 'public, max-age=60, s-maxage=300' });
    return json({ suggestions });
  } catch {
    return json({ suggestions: [] });
  }
};
