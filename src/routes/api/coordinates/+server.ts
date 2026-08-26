import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { coordinatesForPlace } from '$lib/data/places';

/** Exact city/state coordinates from the bundled US places dataset. */
export const GET: RequestHandler = async ({ url, setHeaders }) => {
  const city = (url.searchParams.get('city') || '').trim();
  const state = (url.searchParams.get('state') || '').trim().toUpperCase();

  if (!city || city.length > 80 || /[<>]/.test(city) || !/^[A-Z]{2}$/.test(state)) {
    throw error(400, 'city and a two-letter state are required');
  }

  const coordinates = coordinatesForPlace(city, state);

  setHeaders({ 'Cache-Control': 'public, max-age=86400, s-maxage=2592000' });
  if (!coordinates) return json({ ok: false });
  return json({ ok: true, lat: coordinates[0], lng: coordinates[1] });
};
