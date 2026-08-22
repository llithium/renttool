import { describe, expect, it, vi } from 'vitest';
import { RentPlanWorkspace, type RentPlanAdapters } from './appState.svelte';
import { RentPlanPresentation } from './rentPlanPresentation.svelte';
import type { CitySuggestion, LookupResult } from '$lib/types';

function adapters(result: LookupResult): RentPlanAdapters {
  return {
    lookupRent: vi.fn(async () => result),
    fetchPopulation: vi.fn(async () => null),
    coordinatesForPlace: vi.fn(async () => undefined),
    readStorage: () => null,
    writeStorage: () => undefined
  };
}

function suggestion(label: string, lat = 40): CitySuggestion {
  return {
    label,
    city: label.replace(/,\s*[A-Z]{2}$/, ''),
    state: 'ZZ',
    lat,
    lng: -74
  };
}

const rent: LookupResult = {
  r1: 1_250,
  r2: 1_600,
  yoy: null,
  source: 'hud-fmr',
  rentMetric: 'fair-market-rent',
  rentArea: 'Test County area',
  rentYear: 'FY2026'
};

function presentation(result = rent): RentPlanPresentation {
  const workspace = new RentPlanWorkspace(adapters(result));
  return new RentPlanPresentation(workspace);
}

describe('RentPlanPresentation', () => {
  it('presents the active city and rent target through the planning intents', async () => {
    const plan = presentation();

    plan.setSalary(96_000);
    await plan.chooseCity(suggestion('Current, ZZ'));

    expect(plan.snapshot.activeCity?.name).toBe('Current, ZZ');
    expect(plan.snapshot.rentTarget).toBe(2_400);
    expect(plan.snapshot.budget?.maxRent).toBe(2_400);
  });

  it('keeps active and comparison pending state distinct through one interface', async () => {
    let resolveActive!: (value: LookupResult) => void;
    let resolveComparison!: (value: LookupResult) => void;
    const dependency = adapters(rent);
    dependency.lookupRent = vi
      .fn()
      .mockReturnValueOnce(new Promise<LookupResult>((resolve) => (resolveActive = resolve)))
      .mockReturnValueOnce(new Promise<LookupResult>((resolve) => (resolveComparison = resolve)));
    const plan = new RentPlanPresentation(new RentPlanWorkspace(dependency));

    const active = plan.chooseCity(suggestion('Active, ZZ'));
    const comparison = plan.addComparison(suggestion('Nearby, ZZ', 41));

    expect(plan.snapshot.pendingName).toBe('Active, ZZ');
    expect(plan.snapshot.pendingComparisonNames).toEqual(['Nearby, ZZ']);

    resolveActive(rent);
    await active;
    expect(plan.snapshot.pendingName).toBeNull();
    expect(plan.snapshot.pendingComparisonNames).toEqual(['Nearby, ZZ']);

    resolveComparison(rent);
    await comparison;
    expect(plan.snapshot.comparisonNames).toEqual(['Nearby, ZZ']);
    expect(plan.snapshot.pendingComparisonNames).toEqual([]);
  });

  it('delegates comparison membership and owns map-focus requests', async () => {
    const plan = presentation();

    await plan.chooseCity(suggestion('Current, ZZ'));
    const result = plan.addComparison('Tampa, FL');

    expect(result).toMatchObject({ status: 'added', name: 'Tampa, FL' });
    expect(plan.selectComparisonCity('Tampa, FL')).toBe(true);
    expect(plan.snapshot.activeCity?.name).toBe('Tampa, FL');
    expect(plan.snapshot.mapFocusRequest).toBe(1);

    expect(plan.selectCity('Current, ZZ')).toBe(true);
    expect(plan.snapshot.activeCity?.name).toBe('Current, ZZ');
    expect(plan.snapshot.mapFocusRequest).toBe(1);
  });
});
