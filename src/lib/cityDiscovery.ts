import { SEED_CITIES } from '$lib/data/cities';
import type { City } from '$lib/types';
import { housingRent, type HousingChoice } from '$lib/planning';

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
    population = 'any'
  }: {
    maxRent: number | null;
    housing: HousingChoice;
    state?: string;
    population?: PopulationFilter;
  },
  cities: readonly City[] = SEED_CITIES
): City[] {
  if (maxRent == null && !state && population === 'any') {
    return FEATURED_CITIES.flatMap((name) => cities.find((city) => city.name === name) ?? []);
  }
  return cities
    .filter((city) => {
      const rent = housingRent(city, housing);
      if (rent == null || (maxRent != null && rent > maxRent) || (state && city.state !== state))
        return false;
      const people = city.citySnapshot?.population ?? city.pop;
      if (population !== 'any' && people == null) return false;
      if (population === 'under100k' && people! >= 100_000) return false;
      if (population === '100k-500k' && (people! < 100_000 || people! >= 500_000)) return false;
      if (population === '500k+' && people! < 500_000) return false;
      return true;
    })
    .sort(
      (a, b) => housingRent(a, housing)! - housingRent(b, housing)! || a.name.localeCompare(b.name)
    );
}
