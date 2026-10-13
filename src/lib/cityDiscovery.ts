import { SEED_CITIES } from '$lib/data/cities';
import type { City } from '$lib/types';
import { computeBudget } from '$lib/budget';
import { haversineMiles } from '$lib/geo';
import {
  housingRent,
  computeSpendingRoom,
  rentCeiling,
  type PlanningOptions,
  type HousingChoice
} from '$lib/planning';

export type DiscoverySort = 'rent' | 'spending' | 'distance' | 'target';

export interface DiscoveryFilters {
  state: string;
  population: PopulationFilter;
  sort: DiscoverySort;
  reference: string;
}

export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilters = {
  state: '',
  population: 'any',
  sort: 'rent',
  reference: ''
};

export function normalizeDiscoveryFilters(value: unknown): DiscoveryFilters {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    state:
      typeof record.state === 'string' && SEED_CITIES.some((city) => city.state === record.state)
        ? record.state
        : '',
    population:
      record.population === 'under100k' ||
      record.population === '100k-500k' ||
      record.population === '500k+'
        ? record.population
        : 'any',
    sort:
      record.sort === 'spending' || record.sort === 'distance' || record.sort === 'target'
        ? record.sort
        : 'rent',
    reference:
      typeof record.reference === 'string' &&
      SEED_CITIES.some(
        (city) => city.name === record.reference && city.lat != null && city.lng != null
      )
        ? record.reference
        : ''
  };
}

export type PopulationFilter = 'any' | 'under100k' | '100k-500k' | '500k+';
const FEATURED_CITIES = [
  'Chicago, IL',
  'Seattle, WA',
  'Atlanta, GA',
  'Denver, CO',
  'Charlotte, NC',
  'Philadelphia, PA'
];

export function discoverCities(
  {
    maxRent,
    housing,
    state = '',
    population = 'any',
    sort = 'rent',
    reference,
    salary,
    options
  }: {
    maxRent: number | null;
    housing: HousingChoice;
    state?: string;
    population?: PopulationFilter;
    sort?: DiscoverySort;
    reference?: City | null;
    salary?: number | null;
    options?: PlanningOptions;
  },
  cities: readonly City[] = SEED_CITIES
): City[] {
  if (maxRent == null && !state && population === 'any' && sort === 'rent' && !reference) {
    return FEATURED_CITIES.flatMap((name) => cities.find((city) => city.name === name) ?? []);
  }
  const ceiling = (city: City) =>
    salary != null && options ? rentCeiling(computeBudget(salary, city), options) : maxRent;
  const spending = (city: City) =>
    salary != null && options
      ? computeSpendingRoom(computeBudget(salary, city), city, options).available
      : null;
  const distance = (city: City) =>
    reference?.lat != null && reference.lng != null && city.lat != null && city.lng != null
      ? haversineMiles(reference.lat, reference.lng, city.lat, city.lng)
      : null;
  const score = (city: City): number | null => {
    if (sort === 'spending') {
      const available = spending(city);
      return available == null ? null : -available;
    }
    if (sort === 'distance') return distance(city);
    const rent = housingRent(city, housing);
    const target = ceiling(city);
    return sort === 'target'
      ? rent == null || target == null
        ? null
        : Math.abs(target - rent)
      : rent;
  };
  return cities
    .filter((city) => {
      const rent = housingRent(city, housing);
      const target = ceiling(city);
      if (rent == null || (target != null && rent > target) || (state && city.state !== state))
        return false;
      const people = city.citySnapshot?.population ?? city.pop;
      if (population !== 'any' && people == null) return false;
      if (population === 'under100k' && people! >= 100_000) return false;
      if (population === '100k-500k' && (people! < 100_000 || people! >= 500_000)) return false;
      if (population === '500k+' && people! < 500_000) return false;
      return true;
    })
    .sort(
      (a, b) => (score(a) ?? Infinity) - (score(b) ?? Infinity) || a.name.localeCompare(b.name)
    );
}
