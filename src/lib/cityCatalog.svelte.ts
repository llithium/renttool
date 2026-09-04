import { SEED_CITIES, STATE_TAX, cityOf, findSeedCity, stateOf } from '$lib/data/cities';
import { isValidCoordinates } from '$lib/geo';
import { cityIdentity } from '$lib/cityIdentity';
import { restorePopulation } from '$lib/population';
import type { City, CitySnapshot, CitySuggestion } from '$lib/types';

export type PlanSuggestion = CitySuggestion & {
  pop?: number | null;
};

type CityUpdated = (city: City) => void;

function cloneSeed(): City[] {
  return SEED_CITIES.map((city) => ({ ...city }));
}

function restoreCitySnapshot(value: unknown): CitySnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as Partial<CitySnapshot>;
  if (
    typeof snapshot.population !== 'number' ||
    !Number.isFinite(snapshot.population) ||
    snapshot.population <= 0 ||
    typeof snapshot.householdIncome !== 'number' ||
    !Number.isFinite(snapshot.householdIncome) ||
    snapshot.householdIncome <= 0 ||
    (snapshot.commuteMinutes != null &&
      (typeof snapshot.commuteMinutes !== 'number' ||
        !Number.isFinite(snapshot.commuteMinutes) ||
        snapshot.commuteMinutes < 0 ||
        snapshot.commuteMinutes > 300)) ||
    (snapshot.renterShare != null &&
      (typeof snapshot.renterShare !== 'number' ||
        !Number.isFinite(snapshot.renterShare) ||
        snapshot.renterShare < 0 ||
        snapshot.renterShare > 100)) ||
    (snapshot.rentalVacancy != null &&
      (typeof snapshot.rentalVacancy !== 'number' ||
        !Number.isFinite(snapshot.rentalVacancy) ||
        snapshot.rentalVacancy < 0 ||
        snapshot.rentalVacancy > 100))
  ) {
    return null;
  }
  return {
    population: snapshot.population,
    householdIncome: snapshot.householdIncome,
    commuteMinutes: snapshot.commuteMinutes ?? null,
    renterShare: snapshot.renterShare ?? null,
    rentalVacancy: snapshot.rentalVacancy ?? null
  };
}

export function offListSuggestion(name: string, lat: number, lng: number): PlanSuggestion | null {
  const state = stateOf(name);
  if (
    name.length === 0 ||
    name.length > 100 ||
    cityOf(name).length === 0 ||
    !/^[A-Z]{2}$/.test(state) ||
    !isValidCoordinates(lat, lng)
  ) {
    return null;
  }
  return { label: name, city: cityOf(name), state, lat, lng };
}

/** Validate and rehydrate a city stored in a browser-session record. */
export function restoreCity(value: unknown): City | null {
  if (!value || typeof value !== 'object') return null;
  const city = value as Partial<City>;
  if (
    typeof city.name !== 'string' ||
    city.name.length > 100 ||
    typeof city.city !== 'string' ||
    typeof city.state !== 'string' ||
    !/^[A-Z]{2}$/.test(city.state) ||
    !['apartment-list', 'hud-fmr', 'none'].includes(city.source ?? '') ||
    city.name.trim() !== `${city.city}, ${city.state}` ||
    city.city.trim().length === 0
  ) {
    return null;
  }
  const numberOrNull = (number: unknown) =>
    number == null || (typeof number === 'number' && Number.isFinite(number));
  if (!numberOrNull(city.r1) || !numberOrNull(city.r2) || !numberOrNull(city.yoy)) return null;
  if ((city.r1 != null && city.r1 <= 0) || (city.r2 != null && city.r2 <= 0)) return null;
  if ((city.lat != null || city.lng != null) && !isValidCoordinates(city.lat, city.lng))
    return null;
  const source = city.source as City['source'];
  const metric = ['estimated-median', 'fair-market-rent', 'unknown'].includes(city.rentMetric ?? '')
    ? (city.rentMetric as City['rentMetric'])
    : source === 'apartment-list'
      ? 'estimated-median'
      : source === 'hud-fmr'
        ? 'fair-market-rent'
        : 'unknown';
  if (
    (source === 'apartment-list' && metric !== 'estimated-median') ||
    (source === 'hud-fmr' && metric !== 'fair-market-rent') ||
    (source === 'none' && (metric !== 'unknown' || city.r1 != null || city.r2 != null))
  )
    return null;
  const canonical = findSeedCity(city.name);
  const population = restorePopulation(city.pop) ?? canonical?.pop ?? null;
  return {
    name: city.name,
    city: city.city,
    state: city.state,
    r1: city.r1 ?? null,
    r2: city.r2 ?? null,
    yoy: city.yoy ?? null,
    tax: typeof city.tax === 'string' ? city.tax.slice(0, 200) : STATE_TAX[city.state] || 'varies',
    pop: population,
    populationSource: ['acs', 'apartment-list', 'simplemaps'].includes(city.populationSource ?? '')
      ? (city.populationSource as City['populationSource'])
      : (canonical?.populationSource ?? null),
    citySnapshot: restoreCitySnapshot(city.citySnapshot),
    lat: city.lat ?? undefined,
    lng: city.lng ?? undefined,
    source,
    rentMetric: metric,
    rentArea: typeof city.rentArea === 'string' ? city.rentArea.slice(0, 150) : city.name,
    rentYear: typeof city.rentYear === 'string' ? city.rentYear.slice(0, 40) : ''
  };
}

/**
 * Owns city identity and catalog mutation for the rent-plan workflow.
 *
 * Callers keep references when starting async enrichment. `patchIfCurrent`
 * accepts a result only while that exact catalog entry is still current, so a
 * same-name city replaced by URL navigation cannot receive stale coordinates,
 * population, or rent metadata.
 */
export class CityCatalog {
  private citiesValue = $state<City[]>(cloneSeed());

  constructor(private readonly onUpdated: CityUpdated = () => undefined) {}

  get cities(): City[] {
    return this.citiesValue;
  }

  byName(name: string): City | null {
    const key = cityIdentity(name);
    return this.citiesValue.find((city) => cityIdentity(city.name) === key) ?? null;
  }

  canonicalSuggestion(suggestion: PlanSuggestion): PlanSuggestion {
    const seed = findSeedCity(suggestion.label);
    return seed
      ? { ...suggestion, label: seed.name, city: seed.city, state: seed.state }
      : suggestion;
  }

  patch(name: string, patch: Partial<City>): City | null {
    const key = cityIdentity(name);
    this.citiesValue = this.citiesValue.map((city) =>
      cityIdentity(city.name) === key ? { ...city, ...patch } : city
    );
    const updated = this.byName(name);
    if (updated) this.onUpdated(updated);
    return updated;
  }

  patchIfCurrent(reference: City, patch: Partial<City>): City | null {
    if (this.byName(reference.name) !== reference) return null;
    return this.patch(reference.name, patch);
  }

  ensurePlaceholder(suggestion: PlanSuggestion): City {
    const canonical = findSeedCity(suggestion.label);
    const existing = this.byName(canonical?.name ?? suggestion.label);
    if (existing) {
      const patch: Partial<City> = {};
      if (existing.source === 'apartment-list') {
        if (existing.lat == null && suggestion.lat != null) patch.lat = suggestion.lat;
        if (existing.lng == null && suggestion.lng != null) patch.lng = suggestion.lng;
      } else {
        const coordinatesChanged =
          (suggestion.lat != null && existing.lat !== suggestion.lat) ||
          (suggestion.lng != null && existing.lng !== suggestion.lng);
        if (suggestion.lat != null && existing.lat !== suggestion.lat) patch.lat = suggestion.lat;
        if (suggestion.lng != null && existing.lng !== suggestion.lng) patch.lng = suggestion.lng;
        if (coordinatesChanged) {
          patch.r1 = null;
          patch.r2 = null;
          patch.yoy = null;
          patch.source = 'none';
          patch.rentMetric = 'unknown';
          patch.rentArea = suggestion.label;
          patch.rentYear = '';
        }
      }
      if (existing.pop == null && suggestion.pop != null && suggestion.pop > 0) {
        patch.pop = suggestion.pop;
        patch.populationSource = 'simplemaps';
      }
      if (Object.keys(patch).length) this.patch(existing.name, patch);
      return this.byName(existing.name) ?? existing;
    }

    const city: City = {
      name: suggestion.label,
      city: suggestion.city,
      state: suggestion.state,
      r1: null,
      r2: null,
      yoy: null,
      tax: STATE_TAX[suggestion.state] || 'varies',
      pop: suggestion.pop != null && suggestion.pop > 0 ? suggestion.pop : null,
      populationSource: suggestion.pop != null && suggestion.pop > 0 ? 'simplemaps' : null,
      citySnapshot: null,
      lat: suggestion.lat,
      lng: suggestion.lng,
      source: 'none',
      rentMetric: 'unknown',
      rentArea: suggestion.label,
      rentYear: ''
    };
    this.citiesValue = [...this.citiesValue, city];
    return city;
  }

  addMissing(cities: readonly City[]): void {
    if (!cities.length) return;
    const existing = new Set(this.citiesValue.map((city) => cityIdentity(city.name)));
    const additions = cities.filter((city) => !existing.has(cityIdentity(city.name)));
    if (additions.length) this.citiesValue = [...this.citiesValue, ...additions];
  }

  referencedCustom(names: Iterable<string>): City[] {
    const seedNames = new Set(SEED_CITIES.map((city) => cityIdentity(city.name)));
    const referencedNames = new Set([...names].map(cityIdentity));
    return this.citiesValue.filter(
      (city) =>
        !seedNames.has(cityIdentity(city.name)) && referencedNames.has(cityIdentity(city.name))
    );
  }
}
