import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseAddresses } from '$lib/commute';
import { claimProvider, readCommuteBody } from '$lib/server/commute';

export const POST: RequestHandler = async ({ request, fetch, setHeaders }) => {
  setHeaders({ 'Cache-Control': 'no-store' });
  const body = await readCommuteBody(request);
  if (
    !body ||
    typeof body !== 'object' ||
    !('query' in body) ||
    typeof body.query !== 'string' ||
    body.query.trim().length < 2 ||
    body.query.length > 200
  )
    error(400, 'Enter an address, city, or ZIP code.');
  claimProvider('photon');
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', body.query.trim());
  url.searchParams.set('limit', '10');
  url.searchParams.set('lang', 'en');
  url.searchParams.set('countrycode', 'US');
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'rent-tool/1.0 (commute destination search)' },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('Provider unavailable');
    return json({ destinations: parseAddresses(await response.json()) });
  } catch {
    error(502, 'Address search is unavailable. Try again shortly.');
  }
};
