/**
 * Shared data model for the five main-page design previews (/preview/*).
 * Everything here comes from the bundled datasets, so the previews need no network
 * for their figures; only map tiles and city photos are remote.
 */
import { computeBudget } from '$lib/budget';
import { findSeedCity, SEED_CITIES } from '$lib/data/cities';
import { findCityImage } from '$lib/data/city-images';
import { nearbyPlaces, coordinatesForPlace } from '$lib/data/places';
import { housingRent, rentTargetFit, type HousingChoice } from '$lib/planning';
import { buildSearchLinks, type SearchLink } from '$lib/searchLinks';
import type { City, CityImage, CitySnapshot } from '$lib/types';

export type Fit = 'within' | 'near' | 'above' | 'unknown';

export interface NearbyView {
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  miles: number;
  pop: number;
  rent: number | null;
  fit: Fit;
  /** Rent difference vs. the active city (negative = cheaper). */
  delta: number | null;
  /** Compass bearing from the active city, e.g. "NE". */
  bearing: string;
  hasData: boolean;
}

export interface CityView {
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  salary: number;
  housing: HousingChoice;
  housingLabel: string;
  ceiling: number;
  takeHome: number;
  taxesMonthly: number;
  rent: number | null;
  r1: number | null;
  r2: number | null;
  yoy: number | null;
  fit: Fit;
  /** Ceiling minus rent (negative = over). */
  margin: number | null;
  /** Rent as a share of gross monthly income. */
  rentShare: number | null;
  leftover: number | null;
  salaryNeeded: number | null;
  image: CityImage | null;
  facts: CitySnapshot | null;
  pop: number | null;
  tax: string;
  nearby: NearbyView[];
  links: {
    search: SearchLink[];
    wikipedia: string;
    maps: string;
  };
}

export const CITY_NAMES = SEED_CITIES.map((c) => c.name);

export const HOUSING_LABELS: Record<HousingChoice, string> = {
  '1br': '1 bedroom',
  '2br': '2 bedrooms',
  'shared-2br': 'Shared 2 bedroom'
};

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function bearing(aLat: number, aLng: number, bLat: number, bLng: number): string {
  const y = Math.sin(((bLng - aLng) * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180);
  const x =
    Math.cos((aLat * Math.PI) / 180) * Math.sin((bLat * Math.PI) / 180) -
    Math.sin((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.cos(((bLng - aLng) * Math.PI) / 180);
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(deg / 45) % 8];
}

function coords(city: City): [number, number] | null {
  if (city.lat != null && city.lng != null) return [city.lat, city.lng];
  return coordinatesForPlace(city.city, city.state);
}

export function wikipediaUrl(city: string, state: string, image?: CityImage | null): string {
  if (image && image.source === 'wikimedia' && image.articleUrl) return image.articleUrl;
  const q = `${city}, ${state}`;
  return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}&go=Go`;
}

export function mapsUrl(city: string, state: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city}, ${state}`)}`;
}

export function buildCityView(
  name: string,
  salary: number,
  housing: HousingChoice,
  { photo = true }: { photo?: boolean } = {}
): CityView | null {
  const city = findSeedCity(name);
  if (!city) return null;
  const point = coords(city);
  if (!point) return null;
  const [lat, lng] = point;

  const budget = computeBudget(salary, city);
  const ceiling = budget.maxRent;
  const rent = housingRent(city, housing);
  const fit = rentTargetFit(rent, ceiling) as Fit;
  const image = photo ? findCityImage(city.city, city.state) : null;

  const nearby: NearbyView[] = nearbyPlaces(lat, lng, {
    exclude: { city: city.city, state: city.state },
    limit: 10,
    radiusMiles: 30
  }).map((p) => {
    const seed = findSeedCity(`${p.city}, ${p.state}`);
    const nRent = seed ? housingRent(seed, housing) : null;
    return {
      name: `${p.city}, ${p.state}`,
      city: p.city,
      state: p.state,
      lat: p.lat,
      lng: p.lng,
      miles: Math.round(p.miles),
      pop: p.pop,
      rent: nRent,
      fit: rentTargetFit(nRent, ceiling) as Fit,
      delta: nRent != null && rent != null ? nRent - rent : null,
      bearing: bearing(lat, lng, p.lat, p.lng),
      hasData: seed != null
    };
  });

  return {
    name: city.name,
    city: city.city,
    state: city.state,
    lat,
    lng,
    salary,
    housing,
    housingLabel: HOUSING_LABELS[housing],
    ceiling,
    takeHome: budget.takeHomeMonthly,
    taxesMonthly: budget.grossMonthly - budget.takeHomeMonthly,
    rent,
    r1: city.r1,
    r2: city.r2,
    yoy: city.yoy,
    fit,
    margin: rent != null ? ceiling - rent : null,
    rentShare: rent != null ? rent / budget.grossMonthly : null,
    leftover: rent != null ? budget.takeHomeMonthly - rent : null,
    salaryNeeded: rent != null ? Math.ceil((rent * 40) / 1000) * 1000 : null,
    image,
    facts: city.citySnapshot,
    pop: city.pop,
    tax: city.tax,
    nearby,
    links: {
      search: buildSearchLinks(city, ceiling, housing),
      wikipedia: wikipediaUrl(city.city, city.state, findCityImage(city.city, city.state)),
      maps: mapsUrl(city.city, city.state)
    }
  };
}

/** Deterministic hue for a city, used by no-photo fallbacks so each place keeps its own color. */
export function cityHue(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export const compact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    : n >= 10_000
      ? `${Math.round(n / 1000)}k`
      : n.toLocaleString('en-US');

export const FIT_TEXT: Record<Fit, string> = {
  within: 'Within your budget',
  near: 'Right at your limit',
  above: 'Over your budget',
  unknown: 'No rent estimate'
};

export function signedMoney(n: number): string {
  const r = Math.round(n);
  return `${r < 0 ? '−' : '+'}$${Math.abs(r).toLocaleString('en-US')}`;
}
