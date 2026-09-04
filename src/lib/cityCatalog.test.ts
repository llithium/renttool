import { describe, expect, it, vi } from 'vitest';
import { CityCatalog, restoreCity } from '$lib/cityCatalog.svelte';

function suggestion(name: string, lat = 40, lng = -74) {
  const [city, state] = name.split(', ');
  return { label: name, city, state, lat, lng };
}

describe('CityCatalog', () => {
  it('canonicalizes a bundled alias before callers create catalog entries', () => {
    const catalog = new CityCatalog();

    expect(catalog.canonicalSuggestion(suggestion('New York City, NY'))).toMatchObject({
      label: 'New York, NY',
      city: 'New York',
      state: 'NY'
    });
  });

  it('invalidates rent when URL navigation replaces an off-list city point', () => {
    const catalog = new CityCatalog();
    const original = catalog.ensurePlaceholder(suggestion('Shared Town, ZZ'));
    const enriched = catalog.patch(original.name, {
      r1: 1_250,
      r2: 1_500,
      source: 'hud-fmr',
      rentMetric: 'fair-market-rent',
      rentArea: 'Example County area',
      rentYear: 'FY2026'
    });

    expect(enriched).not.toBeNull();
    const replacement = catalog.ensurePlaceholder(suggestion('Shared Town, ZZ', 41, -75));

    expect(replacement).toMatchObject({
      lat: 41,
      lng: -75,
      r1: null,
      r2: null,
      source: 'none',
      rentMetric: 'unknown',
      rentArea: 'Shared Town, ZZ',
      rentYear: ''
    });
    expect(catalog.patchIfCurrent(enriched!, { pop: 123 })).toBeNull();
    expect(catalog.byName('Shared Town, ZZ')?.pop).toBeNull();
  });

  it('publishes one complete updated city to dependent comparison state', () => {
    const onUpdated = vi.fn();
    const catalog = new CityCatalog(onUpdated);
    const city = catalog.ensurePlaceholder(suggestion('Updated, ZZ'));

    const updated = catalog.patch(city.name, { r1: 1_100, source: 'hud-fmr' });

    expect(onUpdated).toHaveBeenCalledOnce();
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });

  it('returns only referenced off-list cities for session persistence', () => {
    const catalog = new CityCatalog();
    catalog.ensurePlaceholder(suggestion('Kept, ZZ'));
    catalog.ensurePlaceholder(suggestion('Transient, ZZ', 41, -75));

    expect(catalog.referencedCustom(['Kept, ZZ', 'Austin, TX']).map((city) => city.name)).toEqual([
      'Kept, ZZ'
    ]);
  });

  it('rejects contradictory and non-finite persisted city records', () => {
    expect(
      restoreCity({ name: 'Boston, MA', city: 'Tampa', state: 'FL', source: 'none' })
    ).toBeNull();
    expect(
      restoreCity({ name: 'Boston, MA', city: 'Boston', state: 'MA', source: 'none', r1: -1 })
    ).toBeNull();
    expect(
      restoreCity({
        name: 'Example, ZZ',
        city: 'Example',
        state: 'ZZ',
        source: 'none',
        citySnapshot: { population: Infinity, householdIncome: 1 }
      })
    ).toMatchObject({ citySnapshot: null });
  });

  it('restores recognizable legacy populations while rejecting display suffixes', () => {
    const base = { name: 'Example, ZZ', city: 'Example', state: 'ZZ', source: 'none' };
    expect(restoreCity({ ...base, pop: '125,000' })?.pop).toBe(125_000);
    expect(restoreCity({ ...base, pop: '2.8M metro' })?.pop).toBeNull();
  });
});

describe('persisted city invariants', () => {
  const base = {
    name: 'Example, ZZ',
    city: 'Example',
    state: 'ZZ',
    source: 'hud-fmr',
    rentMetric: 'fair-market-rent',
    r1: 1200,
    r2: 1500
  };
  it.each([
    { r1: 0 },
    { r2: Infinity },
    { r1: -1 },
    { source: 'none' },
    { rentMetric: 'estimated-median' },
    { city: '', name: ', ZZ' }
  ])('rejects incoherent fields: %j', (patch) => {
    expect(restoreCity({ ...base, ...patch })).toBeNull();
  });

  it('preserves missing versus measured zero facts through storage restoration', () => {
    const restored = restoreCity({
      ...base,
      citySnapshot: {
        population: 100000,
        householdIncome: 60000,
        commuteMinutes: 0,
        renterShare: null,
        rentalVacancy: 0
      }
    });
    expect(restored?.citySnapshot).toEqual({
      population: 100000,
      householdIncome: 60000,
      commuteMinutes: 0,
      renterShare: null,
      rentalVacancy: 0
    });
  });

  it('restores numeric legacy population without inventing its provider', () => {
    expect(restoreCity({ ...base, pop: '125k' })).toMatchObject({
      pop: 125000,
      populationSource: null
    });
    const bundled = new CityCatalog().byName('Tampa, FL');
    expect(restoreCity({ ...bundled, pop: '2.8M metro' })).toMatchObject({
      pop: bundled?.pop,
      populationSource: 'acs'
    });
  });
});
