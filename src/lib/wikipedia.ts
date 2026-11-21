import { STATE_NAME } from '$lib/data/states';

export interface PlaceSummary {
  /** Plain-text lead paragraph from Wikipedia. */
  extract: string;
  /** The article the extract came from. */
  url: string;
}

/** "Salt Lake City, Utah", the title pattern Wikipedia uses for U.S. places. */
export function wikipediaTitle(place: { city: string; state: string }): string {
  return `${place.city}, ${STATE_NAME[place.state] ?? place.state}`;
}

export function wikipediaUrl(place: { city: string; state: string }): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(wikipediaTitle(place).replaceAll(' ', '_'))}`;
}

/** Split a lead paragraph so the postcard can show its first line on its own. */
export function splitLead(extract: string): { first: string; rest: string } {
  const text = extract.replace(/\s+/g, ' ').trim();
  // A sentence ends at ". " followed by a capital letter, which skips "St. Louis" style
  // abbreviations that are followed by a capitalised word only rarely enough to accept.
  const match = /^(.{40,}?[.!?])\s+(?=[A-Z"(])/.exec(text);
  if (!match) return { first: text, rest: '' };
  return { first: match[1], rest: text.slice(match[0].length).trim() };
}

const cache = new Map<string, Promise<PlaceSummary | null>>();

/** Fetch a place's Wikipedia lead. Resolves null when there is no clear article. */
export function fetchPlaceSummary(
  place: { city: string; state: string },
  fetcher: typeof fetch = fetch
): Promise<PlaceSummary | null> {
  const title = wikipediaTitle(place);
  const cached = cache.get(title);
  if (cached) return cached;
  const request = fetcher(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}?redirect=true`,
    { headers: { accept: 'application/json' } }
  )
    .then(async (response) => {
      if (!response.ok) return null;
      const data = (await response.json()) as Record<string, unknown>;
      if (data.type !== 'standard' || typeof data.extract !== 'string' || !data.extract.trim())
        return null;
      const urls = data.content_urls as { desktop?: { page?: unknown } } | undefined;
      const url = typeof urls?.desktop?.page === 'string' ? urls.desktop.page : wikipediaUrl(place);
      return { extract: data.extract.trim(), url };
    })
    .catch(() => null);
  cache.set(title, request);
  // Let a failed lookup be retried on a later visit.
  void request.then((result) => {
    if (result == null) cache.delete(title);
  });
  return request;
}
