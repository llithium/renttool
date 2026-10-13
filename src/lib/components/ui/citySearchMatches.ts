import { SEED_CITIES, findSeedCity } from '$lib/data/cities';
import { STATE_NAME, VALID_STATES } from '$lib/data/states';
import type { CitySuggestion } from '$lib/types';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bd c\b/g, 'dc')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bfort\b/g, 'ft');
}

function cityTerm(value: string): string {
  const term = normalize(value);
  return term === 'nyc' || term === 'new york city' ? 'new york' : term;
}

function queryParts(query: string): { city: string; states?: string[] } {
  const [city, state] = query.split(',');
  if (state?.trim()) {
    const term = normalize(state);
    return {
      city: cityTerm(city),
      states: Object.entries(STATE_NAME)
        .filter(
          ([code, name]) => code.toLowerCase().startsWith(term) || normalize(name).startsWith(term)
        )
        .map(([code]) => code)
    };
  }
  const term = normalize(query);
  const fullState = Object.entries(STATE_NAME)
    .sort((a, b) => b[1].length - a[1].length)
    .find(([, name]) => term.endsWith(` ${normalize(name)}`));
  if (fullState)
    return {
      city: cityTerm(term.slice(0, -normalize(fullState[1]).length)),
      states: [fullState[0]]
    };
  const words = term.split(' ');
  const suffix = words.at(-1)?.toUpperCase() ?? '';
  if (words.length > 1 && VALID_STATES.has(suffix))
    return { city: cityTerm(words.slice(0, -1).join(' ')), states: [suffix] };
  return { city: cityTerm(term) };
}

/** Identity includes common city-name variants as well as punctuation differences. */
export function suggestionIdentity(suggestion: CitySuggestion): string {
  return `${cityTerm(suggestion.city)}:${suggestion.state.toUpperCase()}`;
}

function score(city: string, term: string): number | null {
  if (!term || city === term) return 0;
  if (city.startsWith(term)) return 1;
  if (city.includes(` ${term}`)) return 2;
  if (city.includes(term)) return 3;
  return null;
}

function ranked(
  query: string,
  suggestions: readonly CitySuggestion[],
  allowUnmatched: boolean
): CitySuggestion[] {
  const parts = queryParts(query);
  return suggestions
    .flatMap((suggestion) => {
      if (parts.states && !parts.states.includes(suggestion.state.toUpperCase())) return [];
      const match = score(cityTerm(suggestion.city), parts.city);
      if (match == null && !allowUnmatched) return [];
      return [
        { suggestion, score: match ?? 4, population: findSeedCity(suggestion.label)?.pop ?? 0 }
      ];
    })
    .sort(
      (a, b) =>
        a.score - b.score ||
        b.population - a.population ||
        a.suggestion.label.localeCompare(b.suggestion.label)
    )
    .map(({ suggestion }) => suggestion);
}

export function localCitySuggestions(query: string): CitySuggestion[] {
  return ranked(
    query,
    SEED_CITIES.map((city) => ({
      label: city.name,
      city: city.city,
      state: city.state,
      lat: city.lat,
      lng: city.lng
    })),
    false
  );
}

/** Keep bundled labels/rent matches while enriching missing coordinates and adding remote places. */
export function mergeCitySuggestions(
  query: string,
  local: readonly CitySuggestion[],
  remote: readonly CitySuggestion[]
): CitySuggestion[] {
  const cities = new Map(local.map((suggestion) => [suggestionIdentity(suggestion), suggestion]));
  for (const suggestion of remote) {
    const key = suggestionIdentity(suggestion);
    const existing = cities.get(key);
    cities.set(
      key,
      existing
        ? { ...existing, lat: existing.lat ?? suggestion.lat, lng: existing.lng ?? suggestion.lng }
        : suggestion
    );
  }
  return ranked(query, [...cities.values()], true);
}
