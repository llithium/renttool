import { SEED_CITIES, STATE_TAX, cityOf, findSeedCity, stateOf } from '$lib/data/cities';
import { popText } from '$lib/format';
import { isValidCoordinates } from '$lib/geo';
import type { City, CitySnapshot, CitySuggestion } from '$lib/types';

export type PlanSuggestion = CitySuggestion & {
  pop?: number | null;
};

type CityUpdated = (city: City) => void;

function cloneSeed(): City[] {
  return SEED_CITIES.map((city) => ({ ...city }));
}

function nameKey(name: string): string {
  return name.toLowerCase();
}

function restoreCitySnapshot(value: unknown): CitySnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as Partial<CitySnapshot>;
  if (
    typeof snapshot.population !== 'number' ||
    snapshot.population <= 0 ||
    typeof snapshot.householdIncome !== 'number' ||
    snapshot.householdIncome <= 0 ||
    typeof snapshot.commuteMinutes !== 'number' ||
    snapshot.commuteMinutes < 0 ||
    snapshot.commuteMinutes > 300 ||
    typeof snapshot.renterShare !== 'number' ||
    snapshot.renterShare < 0 ||
    snapshot.renterShare > 100 ||
    typeof snapshot.rentalVacancy !== 'number' ||
    snapshot.rentalVacancy < 0 ||
    snapshot.rentalVacancy > 100
  ) {
    return null;
  }
  return {
    population: snapshot.population,
    householdIncome: snapshot.householdIncome,
    commuteMinutes: snapshot.commuteMinutes,
    renterShare: snapshot.renterShare,
    rentalVacancy: snapshot.rentalVacancy
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
    !['apartment-list', 'hud-fmr', 'none'].includes(city.source ?? '')
  ) {
    return null;
  }
  const numberOrNull = (number: unknown) =>
    number == null || (typeof number === 'number' && Number.isFinite(number));
  if (!numberOrNull(city.r1) || !numberOrNull(city.r2) || !numberOrNull(city.yoy)) return null;
  if (
    city.lat != null &&
    (typeof city.lat !== 'number' || !Number.isFinite(city.lat) || city.lat < -90 || city.lat > 90)
  ) {
    return null;
  }
  if (
    city.lng != null &&
    (typeof city.lng !== 'number' ||
      !Number.isFinite(city.lng) ||
      city.lng < -180 ||
      city.lng > 180)
  ) {
    return null;
  }
  const source = city.source as City['source'];
  return {
    name: city.name,
    city: city.city,
    state: city.state,
    r1: city.r1 ?? null,
    r2: city.r2 ?? null,
    yoy: city.yoy ?? null,
    tax: typeof city.tax === 'string' ? city.tax.slice(0, 200) : STATE_TAX[city.state] || 'varies',
    pop: typeof city.pop === 'string' ? city.pop.slice(0, 200) : '',
    citySnapshot: restoreCitySnapshot(city.citySnapshot),
    lat: city.lat,
    lng: city.lng,
    source,
    rentMetric: ['estimated-median', 'fair-market-rent', 'unknown'].includes(city.rentMetric ?? '')
      ? (city.rentMetric as City['rentMetric'])
      : source === 'apartment-list'
        ? 'estimated-median'
        : source === 'hud-fmr'
          ? 'fair-market-rent'
          : 'unknown',
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
    const key = nameKey(name);
    return this.citiesValue.find((city) => nameKey(city.name) === key) ?? null;
  }

  canonicalSuggestion(suggestion: PlanSuggestion): PlanSuggestion {
    const seed = findSeedCity(suggestion.label);
    return seed
      ? { ...suggestion, label: seed.name, city: seed.city, state: seed.state }
      : suggestion;
  }

  patch(name: string, patch: Partial<City>): City | null {
    const key = nameKey(name);
    this.citiesValue = this.citiesValue.map((city) =>
      nameKey(city.name) === key ? { ...city, ...patch } : city
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
      if (!existing.pop && suggestion.pop != null && suggestion.pop > 0) {
        patch.pop = popText(suggestion.pop);
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
      pop: suggestion.pop != null && suggestion.pop > 0 ? popText(suggestion.pop) : '',
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
    const existing = new Set(this.citiesValue.map((city) => nameKey(city.name)));
    const additions = cities.filter((city) => !existing.has(nameKey(city.name)));
    if (additions.length) this.citiesValue = [...this.citiesValue, ...additions];
  }

  referencedCustom(names: Iterable<string>): City[] {
    const seedNames = new Set(SEED_CITIES.map((city) => nameKey(city.name)));
    const referencedNames = new Set([...names].map(nameKey));
    return this.citiesValue.filter(
      (city) => !seedNames.has(nameKey(city.name)) && referencedNames.has(nameKey(city.name))
    );
  }
}
