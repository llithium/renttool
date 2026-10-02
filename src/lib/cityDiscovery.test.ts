import { describe, expect, it } from 'vitest';
import { city } from '../../tests/fixtures/city';
import { discoverCities } from './cityDiscovery';

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
