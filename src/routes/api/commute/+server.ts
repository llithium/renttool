import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { isLocation, parseDurations } from '$lib/commute';
import { claimProvider, readCommuteBody } from '$lib/server/commute';

export const POST: RequestHandler = async ({ request, fetch, setHeaders }) => {
  setHeaders({ 'Cache-Control': 'no-store' });
  const body = await readCommuteBody(request);
  if (
    !body ||
    typeof body !== 'object' ||
    !('destination' in body) ||
    !isLocation(body.destination) ||
    !('origins' in body) ||
    !Array.isArray(body.origins) ||
    body.origins.length < 1 ||
    body.origins.length > 8 ||
    !body.origins.every(isLocation)
  )
    error(400, 'Provide a destination and one to eight valid city coordinates.');
  claimProvider('osrm');
  const coordinates = [body.destination, ...body.origins]
    .map(({ lat, lng }) => `${lng},${lat}`)
    .join(';');
  const base = (env.COMMUTE_OSRM_URL || 'https://routing.openstreetmap.de/routed-car').replace(
    /\/$/,
    ''
  );
  const url = new URL(`${base}/table/v1/driving/${coordinates}`);
  url.searchParams.set('sources', body.origins.map((_, index) => index + 1).join(';'));
  url.searchParams.set('destinations', '0');
  url.searchParams.set('annotations', 'duration');
  url.searchParams.set('generate_hints', 'false');
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'rent-tool/1.0 (nearby city commute filter)' },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('Provider unavailable');
    const minutes = parseDurations(await response.json(), body.origins.length);
    if (!minutes) throw new Error('Invalid routing response');
    return json({ minutes });
  } catch {
    error(502, 'Driving times are unavailable. Try again shortly.');
  }
};
