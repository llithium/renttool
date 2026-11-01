import { STATE_NAME } from '../src/lib/data/states';

export interface UnsplashPhoto {
  id?: unknown;
  alt_description?: unknown;
  description?: unknown;
  short_description?: unknown;
  slug?: unknown;
  alternative_slugs?: { en?: unknown };
  urls?: { regular?: unknown };
  links?: { html?: unknown };
  location?: {
    city?: unknown;
    name?: unknown;
  } | null;
  user?: {
    name?: unknown;
    username?: unknown;
    links?: { html?: unknown };
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizedText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function containsPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `);
}

function photoText(photo: UnsplashPhoto): string {
  return normalizedText(
    [
      photo.alt_description,
      photo.description,
      photo.short_description,
      photo.slug,
      photo.alternative_slugs?.en,
      photo.location?.city,
      photo.location?.name
    ]
      .map(stringValue)
      .filter((value): value is string => value != null)
      .join(' ')
  );
}

/** Match a photo only when its structured location metadata names the requested state. */
export function matchesCity(photo: UnsplashPhoto, city: string, state: string): boolean {
  const requestedCity = normalizedText(city);
  const text = photoText(photo);
  const locationCity = normalizedText(stringValue(photo.location?.city) || '');
  if (locationCity && locationCity !== requestedCity) return false;
  const cityMatches = locationCity === requestedCity || containsPhrase(text, requestedCity);

  const locationName = normalizedText(stringValue(photo.location?.name) || '');
  const stateName = STATE_NAME[state];
  const stateMatches =
    Boolean(stateName && containsPhrase(locationName, normalizedText(stateName))) ||
    containsPhrase(locationName, normalizedText(state));

  return cityMatches && stateMatches;
}

/** Search ranking alone is not evidence that a photo depicts this city and state. */
export function selectPhoto(results: unknown[], city: string, state: string): UnsplashPhoto | null {
  const photos = results.filter((result): result is UnsplashPhoto =>
    Boolean(result && typeof result === 'object')
  );

  return photos.find((photo) => matchesCity(photo, city, state)) ?? null;
}
