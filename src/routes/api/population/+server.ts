import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { coordinatesFromSearch } from '$lib/geo';
import { placeAt } from '$lib/data/places';

/** Population of the place at the given coordinates, from the bundled US places
 * dataset (nearest place within 10 miles). */
export const GET: RequestHandler = async ({ url, setHeaders }) => {
  const coordinates = coordinatesFromSearch(url.searchParams);
  if (!coordinates) {
    throw error(400, 'lat and lng are required and must be valid coordinates');
  }
  const [lat, lng] = coordinates;

  const place = placeAt(lat, lng);

  // Static bundled data — cache freely.
  setHeaders({ 'Cache-Control': 'public, max-age=86400, s-maxage=2592000' });
  if (!place) return json({ ok: false });
  return json({ ok: true, pop: place.pop, name: place.city, source: 'simplemaps' });
};
