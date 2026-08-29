import { describe, expect, it, vi } from 'vitest';
import { CityCatalog } from '$lib/cityCatalog.svelte';

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
    expect(catalog.patchIfCurrent(enriched!, { pop: 'stale' })).toBeNull();
    expect(catalog.byName('Shared Town, ZZ')?.pop).toBe('');
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
});
