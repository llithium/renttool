import { describe, expect, it } from 'vitest';
import { city } from '../../tests/fixtures/city';
import { discoverCities, normalizeDiscoveryFilters } from './cityDiscovery';

describe('budget-aware city discovery', () => {
  const places = [
    { ...city('Small, TX', 1000), pop: 50000 },
    { ...city('Large, TX', 1800), pop: 600000 },
    { ...city('Other, FL', 1100), pop: 200000 },
    { ...city('Unknown, TX', 1000), pop: null }
  ];
  it('combines rent, state, and population filters', () => {
    expect(
      discoverCities(
        { maxRent: 1200, housing: '1br', state: 'TX', population: 'under100k' },
        places
      ).map((place) => place.name)
    ).toEqual(['Small, TX']);
    expect(
      discoverCities(
        { maxRent: 1200, housing: 'shared-2br', state: 'TX', population: '500k+' },
        places
      ).map((place) => place.name)
    ).toEqual(['Large, TX']);
    expect(discoverCities({ maxRent: 500, housing: '2br' }, places)).toEqual([]);
  });
});

it('sorts by target proximity, spending room, and distance with missing coordinates last', () => {
  const options = { housing: '1br', monthlyExpenses: 1000, monthlySavings: 500 } as const;
  const a = { ...city('Alpha, TX', 1000), lat: 30, lng: -90 };
  const b = { ...city('Beta, TX', 1500), lat: 31, lng: -90 };
  const c = { ...city('Gamma, TX', 1200), lat: undefined, lng: undefined };
  const cities = [b, c, a];
  const input = { maxRent: 2000, housing: '1br', salary: 80000, options } as const;
  expect(discoverCities({ ...input, sort: 'target' }, cities).map((c) => c.name)).toEqual([
    'Beta, TX',
    'Gamma, TX',
    'Alpha, TX'
  ]);
  expect(discoverCities({ ...input, sort: 'spending' }, cities).map((c) => c.name)).toEqual([
    'Alpha, TX',
    'Gamma, TX',
    'Beta, TX'
  ]);
  expect(
    discoverCities({ ...input, sort: 'distance', reference: b }, cities).map((c) => c.name)
  ).toEqual(['Beta, TX', 'Alpha, TX', 'Gamma, TX']);
  expect(
    normalizeDiscoveryFilters({
      sort: 'unknown',
      population: 'unknown',
      state: 'ZZ',
      reference: 'Unknown, ZZ'
    })
  ).toEqual({ sort: 'rent', population: 'any', state: '', reference: '' });
});
