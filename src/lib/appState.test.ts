import { describe, expect, it, vi } from 'vitest';
import { RentPlanWorkspace, type RentPlanAdapters } from './appState.svelte';
import {
  COMPARISON_STORAGE_KEY,
  DEFAULT_COMPARISON_SALARY
} from '$lib/compare/comparisonSet.svelte';
import type { CitySuggestion, LookupResult } from '$lib/types';

function adapters(
  result: LookupResult,
  initialStorage: Record<string, string> = {}
): RentPlanAdapters {
  const storage = new Map(Object.entries(initialStorage));
  return {
    lookupRent: vi.fn(async () => result),
    fetchPopulation: vi.fn(async () => null),
    coordinatesForPlace: vi.fn(async () => undefined),
    readStorage: (key) => storage.get(key) ?? null,
    writeStorage: (key, value) => storage.set(key, value)
  };
}

function suggestion(label: string, state = 'ZZ'): CitySuggestion {
  return { label, city: label.replace(/,\s*[A-Z]{2}$/, ''), state, lat: 40, lng: -74 };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

const unavailableRent: LookupResult = {
  r1: null,
  r2: null,
  yoy: null,
  source: 'none',
  rentMetric: 'unknown',
  rentArea: '',
  rentYear: ''
};

const hudRent: LookupResult = {
  r1: 1_250,
  r2: 1_600,
  yoy: null,
  source: 'hud-fmr',
  rentMetric: 'fair-market-rent',
  rentArea: 'Test County area',
  rentYear: 'FY2026'
};

describe('RentPlanWorkspace', () => {
  it('exposes plan intent through a snapshot and preserves salary invariants', () => {
    const plan = new RentPlanWorkspace(adapters(unavailableRent));

    plan.setSalary(95_000.4);

    expect(plan.snapshot.salary).toBe(95_000);
    plan.setSalary(12_000_001);
    expect(plan.snapshot.salary).toBeNull();
  });

  it('commits an unresolved city while keeping rent unavailable explicit', async () => {
    const plan = new RentPlanWorkspace(adapters(unavailableRent));

    await plan.chooseCity(suggestion('Nowhere, ZZ'));

    expect(plan.snapshot.selectedName).toBe('Nowhere, ZZ');
    expect(plan.snapshot.selected?.r1).toBeNull();
    expect(plan.snapshot.looking).toBe(false);
    expect(plan.snapshot.pendingName).toBeNull();
  });

  it('adds a comparison without changing the active plan', async () => {
    const plan = new RentPlanWorkspace(adapters(hudRent));
    await plan.chooseCity(suggestion('Current, ZZ'));

    const result = await plan.addComparison(suggestion('Nearby, ZZ'));

    expect(result.status).toBe('added');
    expect(plan.snapshot.selectedName).toBe('Current, ZZ');
    expect(plan.snapshot.compareNames).toEqual(['Nearby, ZZ']);
  });

  it('keeps active-city and comparison resolutions independent with intent-specific pending state', async () => {
    const activeRent = deferred<LookupResult>();
    const comparisonRent = deferred<LookupResult>();
    const lookupRent = vi
      .fn()
      .mockReturnValueOnce(activeRent.promise)
      .mockReturnValueOnce(comparisonRent.promise);
    const dependency = adapters(hudRent);
    dependency.lookupRent = lookupRent;
    const plan = new RentPlanWorkspace(dependency);

    const activePromise = plan.chooseCity(suggestion('Active, ZZ'));
    const comparisonPromise = plan.addComparison({
      ...suggestion('Nearby, ZZ'),
      lat: 41
    });

    expect(plan.snapshot.looking).toBe(true);
    expect(plan.snapshot.pendingName).toBe('Active, ZZ');
    expect(plan.snapshot.pendingComparisonNames).toEqual(['Nearby, ZZ']);

    activeRent.resolve(hudRent);
    await activePromise;

    expect(plan.snapshot.selectedName).toBe('Active, ZZ');
    expect(plan.snapshot.pendingName).toBeNull();
    expect(plan.snapshot.pendingComparisonNames).toEqual(['Nearby, ZZ']);

    comparisonRent.resolve(hudRent);
    const result = await comparisonPromise;

    expect(result.status).toBe('added');
    expect(plan.snapshot.compareNames).toEqual(['Nearby, ZZ']);
    expect(plan.snapshot.pendingComparisonNames).toEqual([]);
  });

  it('cancels stale active-city work without allowing its completion to replace the newer city', async () => {
    const firstRent = deferred<LookupResult>();
    const secondRent = deferred<LookupResult>();
    const signals: AbortSignal[] = [];
    const lookupRent = vi.fn((_lat: number, _lng: number, signal?: AbortSignal) => {
      signals.push(signal!);
      return signals.length === 1 ? firstRent.promise : secondRent.promise;
    });
    const dependency = adapters(hudRent);
    dependency.lookupRent = lookupRent;
    const plan = new RentPlanWorkspace(dependency);

    const first = plan.chooseCity(suggestion('First, ZZ'));
    const second = plan.chooseCity(suggestion('Second, ZZ'));

    expect(signals[0]?.aborted).toBe(true);
    expect(plan.snapshot.pendingName).toBe('Second, ZZ');

    firstRent.resolve(hudRent);
    await first;
    expect(plan.snapshot.selectedName).toBeNull();
    expect(plan.snapshot.pendingName).toBe('Second, ZZ');

    secondRent.resolve(hudRent);
    await second;

    expect(plan.snapshot.selectedName).toBe('Second, ZZ');
    expect(plan.snapshot.selected?.r1).toBe(1_250);
  });

  it('deduplicates one city lookup shared by active selection and comparison addition', async () => {
    const rent = deferred<LookupResult>();
    const dependency = adapters(hudRent);
    dependency.lookupRent = vi.fn(() => rent.promise);
    const plan = new RentPlanWorkspace(dependency);
    const shared = suggestion('Shared, ZZ');

    const active = plan.chooseCity(shared);
    const comparison = plan.addComparison({ ...shared, pop: 12_000 });

    expect(dependency.lookupRent).toHaveBeenCalledTimes(1);
    expect(plan.snapshot.pendingName).toBe('Shared, ZZ');
    expect(plan.snapshot.pendingComparisonNames).toEqual(['Shared, ZZ']);

    rent.resolve(hudRent);
    await active;
    const result = await comparison;

    expect(result.status).toBe('added');
    expect(plan.snapshot.selectedName).toBe('Shared, ZZ');
    expect(plan.snapshot.compareNames).toEqual(['Shared, ZZ']);
    expect(plan.snapshot.selected?.pop).toBe('12,000');
  });

  it('restarts a same-city lookup after its only consumer is canceled', async () => {
    const firstRent = deferred<LookupResult>();
    const secondRent = deferred<LookupResult>();
    const signals: AbortSignal[] = [];
    const dependency = adapters(hudRent);
    dependency.lookupRent = vi.fn((_lat: number, _lng: number, signal?: AbortSignal) => {
      signals.push(signal!);
      return signals.length === 1 ? firstRent.promise : secondRent.promise;
    });
    const plan = new RentPlanWorkspace(dependency);

    const first = plan.chooseCity(suggestion('Retry, ZZ'));
    const second = plan.chooseCity(suggestion('Retry, ZZ'));

    expect(dependency.lookupRent).toHaveBeenCalledTimes(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    firstRent.resolve(hudRent);
    secondRent.resolve(hudRent);
    await Promise.all([first, second]);

    expect(plan.snapshot.selectedName).toBe('Retry, ZZ');
    expect(plan.snapshot.selected?.r1).toBe(1_250);
  });

  it('resolves coordinates before looking up a coordinate-less off-list city', async () => {
    const dependency = adapters(hudRent);
    dependency.coordinatesForPlace = vi.fn(async () => [40.7, -74] as const);
    const plan = new RentPlanWorkspace(dependency);

    const result = await plan.addComparison({
      label: 'Off-list, ZZ',
      city: 'Off-list',
      state: 'ZZ'
    });

    expect(result.status).toBe('added');
    expect(dependency.coordinatesForPlace).toHaveBeenCalledWith('Off-list', 'ZZ');
    expect(dependency.lookupRent).toHaveBeenCalledWith(40.7, -74, expect.any(AbortSignal));
  });

  it('identifies an active city while its coordinates are still resolving', async () => {
    const coordinates = deferred<readonly [number, number]>();
    const dependency = adapters(hudRent);
    dependency.coordinatesForPlace = vi.fn(() => coordinates.promise);
    const plan = new RentPlanWorkspace(dependency);

    const pending = plan.chooseCity({
      label: 'Waiting, ZZ',
      city: 'Waiting',
      state: 'ZZ'
    });

    expect(plan.snapshot.pendingName).toBe('Waiting, ZZ');
    expect(plan.snapshot.looking).toBe(true);

    coordinates.resolve([40.7, -74]);
    await pending;

    expect(plan.snapshot.selectedName).toBe('Waiting, ZZ');
    expect(plan.snapshot.pendingName).toBeNull();
  });

  it('enforces the comparison cap before resolving another city', async () => {
    const dependency = adapters(hudRent);
    const plan = new RentPlanWorkspace(dependency);

    for (let index = 0; index < 5; index += 1) {
      const result = await plan.addComparison(suggestion(`City ${index}, ZZ`));
      expect(result.status).toBe('added');
    }

    const result = await plan.addComparison(suggestion('City 5, ZZ'));

    expect(result.status).toBe('full');
    expect(dependency.lookupRent).toHaveBeenCalledTimes(5);
    expect(plan.snapshot.compareNames).toHaveLength(5);
  });

  it('keeps comparison salaries complete and independent from the rent plan', () => {
    const plan = new RentPlanWorkspace(adapters(unavailableRent));
    plan.setSalary(95_000);

    expect(plan.addComparison('Tampa, FL')).toMatchObject({
      status: 'added',
      salary: 95_000
    });
    expect(plan.addComparison('Austin, TX')).toMatchObject({
      status: 'added',
      salary: 95_000
    });

    expect(plan.setComparisonSalary('Tampa, FL', 61_000)).toBe(true);
    expect(plan.setComparisonSalary('Tampa, FL', 0)).toBe(false);
    expect(plan.snapshot.salary).toBe(95_000);
    expect(plan.snapshot.compareEntries.map((entry) => entry.salary)).toEqual([61_000, 95_000]);

    expect(plan.removeComparison('Tampa, FL')).toBe(true);
    expect(plan.addComparison('Tampa, FL')).toMatchObject({
      status: 'added',
      salary: 95_000
    });
    expect(plan.snapshot.compareEntries[1]?.salary).toBe(95_000);

    const noPlan = new RentPlanWorkspace(adapters(unavailableRent));
    noPlan.addComparison('Tampa, FL');
    expect(noPlan.snapshot.compareEntries[0]?.salary).toBe(DEFAULT_COMPARISON_SALARY);
  });

  it('builds a canonical URL with rounded salary and fixed parameter ordering', async () => {
    const plan = new RentPlanWorkspace(adapters(hudRent));

    plan.setSalary(80_000.6);
    await plan.chooseCity(suggestion('Current, ZZ'));
    await plan.addComparison(suggestion('Nearby, ZZ'));

    expect(plan.buildSearch()).toBe(
      'salary=80001&city=Current%2C+ZZ&lat=40&lng=-74&compare-offlist=%7B%22name%22%3A%22Nearby%2C+ZZ%22%2C%22lat%22%3A40%2C%22lng%22%3A-74%7D&compare-salary=%7B%22name%22%3A%22Nearby%2C+ZZ%22%2C%22salary%22%3A80001%7D'
    );
  });

  it('ignores malformed salary and invalid off-list coordinates during URL hydration', () => {
    const plan = new RentPlanWorkspace(adapters(unavailableRent));
    plan.setSalary(80_000);

    const selected = plan.hydrateFromSearch(
      new URLSearchParams({ salary: 'not-a-number', city: 'Unknown, ZZ', lat: '91', lng: '-74' })
    );

    expect(selected).toBe(false);
    expect(plan.snapshot.salary).toBe(80_000);
    expect(plan.snapshot.selectedName).toBeNull();
  });

  it('ignores an out-of-range salary during URL hydration', () => {
    const plan = new RentPlanWorkspace(adapters(unavailableRent));

    plan.hydrateFromSearch(new URLSearchParams({ salary: '10000001' }));

    expect(plan.snapshot.salary).toBeNull();
  });

  it('hydrates a known seed city and five deduplicated seed comparisons', () => {
    const plan = new RentPlanWorkspace(adapters(unavailableRent));

    const selected = plan.hydrateFromSearch(
      new URLSearchParams([
        ['salary', '95000'],
        ['city', 'New York, NY'],
        ['compare', 'Tampa, FL'],
        ['compare', 'Tampa, FL'],
        ['compare', 'Austin, TX'],
        ['compare', 'Boston, MA'],
        ['compare', 'Miami, FL'],
        ['compare', 'New York, NY'],
        ['compare', 'Seattle, WA']
      ])
    );

    expect(selected).toBe(true);
    expect(plan.snapshot.selectedName).toBe('New York, NY');
    expect(plan.snapshot.salary).toBe(95_000);
    expect(plan.snapshot.compareNames).toEqual([
      'Tampa, FL',
      'Austin, TX',
      'Boston, MA',
      'Miami, FL',
      'New York, NY'
    ]);
  });

  it('restores complete comparison salaries from a shared link over older local state', () => {
    const plan = new RentPlanWorkspace(
      adapters(unavailableRent, {
        'rentToolLast.v3': JSON.stringify({
          salary: 90_000,
          compare: ['Tampa, FL']
        })
      })
    );
    const search = new URLSearchParams({ salary: '70000', compare: 'Austin, TX' });
    search.append('compare-salary', JSON.stringify({ name: 'Austin, TX', salary: 66_000 }));

    expect(plan.hydrateFromSearch(search)).toBe(true);
    expect(plan.snapshot.compareEntries.map((entry) => [entry.city.name, entry.salary])).toEqual([
      ['Austin, TX', 66_000]
    ]);
    expect(plan.snapshot.salary).toBe(70_000);
  });

  it('uses deterministic salaries for older shared links without entry salaries', () => {
    const withPlanSalary = new RentPlanWorkspace(adapters(unavailableRent));
    withPlanSalary.hydrateFromSearch(
      new URLSearchParams({ salary: '70000', compare: 'Austin, TX' })
    );
    expect(withPlanSalary.snapshot.compareEntries[0]?.salary).toBe(70_000);

    const withoutSalary = new RentPlanWorkspace(adapters(unavailableRent));
    withoutSalary.hydrateFromSearch(new URLSearchParams({ compare: 'Austin, TX' }));
    expect(withoutSalary.snapshot.compareEntries[0]?.salary).toBe(DEFAULT_COMPARISON_SALARY);
  });

  it('hydrates off-list comparison placeholders, validates entries, and caps URL order', async () => {
    const plan = new RentPlanWorkspace(adapters(hudRent));
    const valid = (name: string, lat = 40, lng = -74) => JSON.stringify({ name, lat, lng });
    const search = new URLSearchParams([
      ['city', 'Active, ZZ'],
      ['lat', '40.1'],
      ['lng', '-73.9'],
      ['compare-offlist', valid('Off-list, ZZ', 40.1, -73.9)],
      ['compare', 'Tampa, FL'],
      ['compare-offlist', valid('off-list, zz', 40.1, -73.9)],
      ['compare-offlist', '{not-json'],
      ['compare-offlist', valid('Bad coordinates, ZZ', 91, -74)],
      ['compare', 'Austin, TX'],
      ['compare', 'Boston, MA'],
      ['compare', 'Miami, FL'],
      ['compare-offlist', valid('Overflow, ZZ', 41, -75)]
    ]);

    expect(plan.hydrateFromSearch(search)).toBe(true);
    expect(plan.snapshot.compareNames).toEqual([
      'Off-list, ZZ',
      'Tampa, FL',
      'Austin, TX',
      'Boston, MA',
      'Miami, FL'
    ]);
    expect(plan.cityByName('Off-list, ZZ')).toMatchObject({
      name: 'Off-list, ZZ',
      lat: 40.1,
      lng: -73.9
    });
    expect(plan.cityByName('Bad coordinates, ZZ')).toBeNull();
    expect(plan.cityByName('Overflow, ZZ')).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(plan.snapshot.selectedName).toBe('Active, ZZ');
    expect(plan.cityByName('Off-list, ZZ')).toMatchObject({
      source: 'hud-fmr',
      r1: 1_250
    });
    expect(plan.snapshot.compareNames).toHaveLength(5);
  });

  it('canonicalizes shared-link comparison aliases before creating entries', () => {
    const plan = new RentPlanWorkspace(adapters(unavailableRent));
    const search = new URLSearchParams({
      'compare-offlist': JSON.stringify({ name: 'New York City, NY', lat: 40.71, lng: -74 })
    });

    expect(plan.hydrateFromSearch(search)).toBe(true);
    expect(plan.snapshot.compareNames).toEqual(['New York, NY']);
    expect(
      plan.snapshot.cities.filter((city) => city.name.toLowerCase() === 'new york city, ny')
    ).toHaveLength(0);
    expect(plan.cityByName('New York, NY')?.source).toBe('apartment-list');
  });

  it('restores every valid off-list link entry concurrently and keeps each completion', async () => {
    const requests = new Map<number, ReturnType<typeof deferred<LookupResult>>>();
    const signals: AbortSignal[] = [];
    const dependency = adapters(hudRent);
    dependency.lookupRent = vi.fn((lat: number, _lng: number, signal?: AbortSignal) => {
      const request = deferred<LookupResult>();
      requests.set(lat, request);
      signals.push(signal!);
      return request.promise;
    });
    const plan = new RentPlanWorkspace(dependency);
    const offList = (name: string, lat: number) => JSON.stringify({ name, lat, lng: -74 });
    const search = new URLSearchParams([
      ['city', 'Restored active, ZZ'],
      ['lat', '40'],
      ['lng', '-74'],
      ['compare-offlist', offList('Restored one, ZZ', 41)],
      ['compare-offlist', offList('Restored two, ZZ', 42)],
      ['compare-offlist', offList('Restored three, ZZ', 43)]
    ]);

    expect(plan.hydrateFromSearch(search)).toBe(true);
    expect(dependency.lookupRent).toHaveBeenCalledTimes(4);
    expect(plan.snapshot.pendingName).toBe('Restored active, ZZ');
    expect(plan.snapshot.pendingComparisonNames).toEqual([
      'Restored one, ZZ',
      'Restored two, ZZ',
      'Restored three, ZZ'
    ]);
    expect(signals.every((signal) => !signal.aborted)).toBe(true);

    requests.get(43)?.resolve(hudRent);
    requests.get(41)?.resolve(hudRent);
    requests.get(40)?.resolve(hudRent);
    requests.get(42)?.resolve(hudRent);
    await Promise.all([...requests.values()].map((request) => request.promise));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(plan.snapshot.selectedName).toBe('Restored active, ZZ');
    expect(plan.snapshot.compareNames).toEqual([
      'Restored one, ZZ',
      'Restored two, ZZ',
      'Restored three, ZZ'
    ]);
    expect(plan.snapshot.pendingName).toBeNull();
    expect(plan.snapshot.pendingComparisonNames).toEqual([]);
    expect(plan.snapshot.compareCities.every((city) => city.r1 === 1_250)).toBe(true);
  });

  it('persists enriched off-list cities in both the plan and comparison records', async () => {
    const storage = new Map<string, string>();
    const rent = deferred<LookupResult>();
    const dependency = adapters(hudRent);
    dependency.lookupRent = vi.fn(() => rent.promise);
    dependency.readStorage = (key) => storage.get(key) ?? null;
    dependency.writeStorage = (key, value) => storage.set(key, value);
    const plan = new RentPlanWorkspace(dependency);

    const pending = plan.addComparison(suggestion('Persisted, ZZ'));
    rent.resolve(hudRent);
    await pending;

    const savedPlan = JSON.parse(storage.get('rentToolLast.v3') ?? '{}') as {
      custom?: Array<{ name: string; r1: number | null; source: string }>;
    };
    const savedComparison = JSON.parse(storage.get(COMPARISON_STORAGE_KEY) ?? '{}') as {
      entries?: Array<{ city: { name: string; r1: number | null; source: string } }>;
    };

    expect(savedPlan.custom).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Persisted, ZZ',
          r1: 1_250,
          source: 'hud-fmr'
        })
      ])
    );
    expect(savedComparison.entries?.[0]?.city).toMatchObject({
      name: 'Persisted, ZZ',
      r1: 1_250,
      source: 'hud-fmr'
    });
  });

  it('cancels a stale comparison addition when URL navigation replaces the workspace state', async () => {
    const storage = new Map<string, string>();
    const rent = deferred<LookupResult>();
    let signal: AbortSignal | undefined;
    const dependency = adapters(hudRent);
    dependency.lookupRent = vi.fn((_lat: number, _lng: number, requestSignal?: AbortSignal) => {
      signal = requestSignal;
      return rent.promise;
    });
    dependency.readStorage = (key) => storage.get(key) ?? null;
    dependency.writeStorage = (key, value) => storage.set(key, value);
    const plan = new RentPlanWorkspace(dependency);

    const pending = plan.addComparison(suggestion('Stale, ZZ'));
    plan.applyUrlNavigation(new URLSearchParams());

    expect(signal?.aborted).toBe(true);
    expect(plan.snapshot.compareNames).toEqual([]);
    expect(plan.snapshot.pendingComparisonNames).toEqual([]);

    rent.resolve(hudRent);
    await pending;

    expect(plan.snapshot.compareNames).toEqual([]);
    expect(plan.snapshot.pendingComparisonNames).toEqual([]);
    expect(JSON.parse(storage.get('rentToolLast.v3') ?? '{}').custom).toEqual([]);
  });

  it('clears absent salary, city, and comparison state on URL navigation', () => {
    const plan = new RentPlanWorkspace(adapters(unavailableRent));

    plan.setSalary(80_000);
    plan.selectCity('Tampa, FL');
    plan.addComparison('Austin, TX');
    plan.applyUrlNavigation(new URLSearchParams());

    expect(plan.snapshot.salary).toBeNull();
    expect(plan.snapshot.selectedName).toBeNull();
    expect(plan.snapshot.compareNames).toEqual([]);
  });

  it('restores a valid custom city and comparison set from adapter storage', () => {
    const savedCity = {
      name: 'Saved Town, ZZ',
      city: 'Saved Town',
      state: 'ZZ',
      r1: null,
      r2: null,
      yoy: null,
      tax: 'varies',
      pop: '',
      citySnapshot: null,
      lat: 40,
      lng: -74,
      source: 'none',
      rentMetric: 'unknown',
      rentArea: 'Saved Town, ZZ',
      rentYear: ''
    };
    const plan = new RentPlanWorkspace(
      adapters(unavailableRent, {
        'rentToolLast.v3': JSON.stringify({
          salary: 90_000,
          selected: 'Saved Town, ZZ',
          compare: ['Saved Town, ZZ', 'Tampa, FL'],
          custom: [savedCity]
        })
      })
    );

    plan.restoreSession();

    expect(plan.snapshot.salary).toBe(90_000);
    expect(plan.snapshot.selectedName).toBe('Saved Town, ZZ');
    expect(plan.snapshot.selected).toMatchObject(savedCity);
    expect(plan.snapshot.compareNames).toEqual(['Saved Town, ZZ', 'Tampa, FL']);
  });
});
