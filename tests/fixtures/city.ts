import type { City } from '../../src/lib/types';

export function city(name: string, r1: number | null): City {
  const [cityName, state] = name.split(', ');
  return {
    name,
    city: cityName,
    state,
    r1,
    r2: r1 == null ? null : r1 + 300,
    yoy: r1 == null ? null : 1.2,
    tax: 'varies',
    pop: 100_000,
    populationSource: 'apartment-list',
    citySnapshot: null,
    lat: 40,
    lng: -74,
    source: r1 == null ? 'none' : 'apartment-list',
    rentMetric: r1 == null ? 'unknown' : 'estimated-median',
    rentArea: name,
    rentYear: 'June 2026'
  };
}
