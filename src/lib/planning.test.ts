import { describe, expect, it } from 'vitest';
import { city } from '../../tests/fixtures/city';
import { computeBudget } from './budget';
import {
  comparisonQualification,
  computeSpendingRoom,
  housingRent,
  normalizePlanningOptions
} from './planning';

describe('housing and personal spending room', () => {
  it('uses the chosen bedroom estimate and divides shared rent equally', () => {
    const place = city('Austin, TX', 1200);
    expect(housingRent(place, '1br')).toBe(1200);
    expect(housingRent(place, '2br')).toBe(1500);
    expect(housingRent(place, 'shared-2br')).toBe(750);
    expect(housingRent({ r1: 1200, r2: null }, '2br')).toBeNull();
  });

  it('preserves deficits and an entered zero paycheck without changing the gross rent target', () => {
    const place = city('Austin, TX', 1200);
    const budget = computeBudget(80000, place);
    const options = { housing: 'shared-2br', monthlyExpenses: 1000, monthlySavings: 500 } as const;
    expect(computeSpendingRoom(budget, place, options, 2000)).toMatchObject({
      rent: 750,
      afterRent: 1250,
      available: -250
    });
    expect(computeSpendingRoom(budget, place, options, 0).available).toBe(-2250);
    expect(budget.maxRent).toBe(2000);
  });

  it('rejects invalid stored settings and qualifies incompatible rent statistics', () => {
    expect(
      normalizePlanningOptions({ housing: 'studio', monthlyExpenses: -1, monthlySavings: Infinity })
    ).toEqual({ housing: '1br', monthlyExpenses: 0, monthlySavings: 0 });
    const median = city('Austin, TX', 1200);
    const hud = {
      ...city('Other, TX', 1000),
      source: 'hud-fmr',
      rentMetric: 'fair-market-rent',
      rentYear: 'FY2027'
    } as const;
    expect(comparisonQualification([median, hud])).toContain('40th-percentile');
    expect(comparisonQualification([median, { ...median }])).toBeNull();
  });
});
