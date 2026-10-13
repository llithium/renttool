import { describe, expect, it } from 'vitest';
import { city } from '../../tests/fixtures/city';
import { computeBudget } from './budget';
import {
  comparisonQualification,
  rentCeiling,
  checkApartment,
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

describe('personal ceilings and apartment checks', () => {
  it('reserves personal goals and buffer, caps the ceiling, and preserves a zero paycheck', () => {
    const budget = computeBudget(80000, 'TX');
    const options = {
      housing: '1br',
      monthlyExpenses: 1200,
      monthlySavings: 500,
      monthlyBuffer: 400
    } as const;
    expect(rentCeiling(budget, options, 3500)).toBe(1400);
    expect(rentCeiling(budget, options, 9000)).toBe(2000);
    expect(rentCeiling(budget, options, 0)).toBe(0);
    expect(rentCeiling(budget, { ...options, budgetMode: 'gross' }, 0)).toBe(2000);
    expect(
      normalizePlanningOptions({ ...options, monthlyBuffer: -5 }).monthlyBuffer
    ).toBeUndefined();
  });

  it('checks recurring costs separately from one-time costs and keeps shortfalls visible', () => {
    const budget = computeBudget(80000, 'TX');
    const options = {
      housing: '1br',
      monthlyExpenses: 1000,
      monthlySavings: 500,
      monthlyBuffer: 300
    } as const;
    const costs = { rent: 1500, utilities: 100, parking: 50, fees: 25, deposit: 1500, moving: 700 };
    expect(checkApartment(budget, options, costs, 4000)).toEqual({
      monthly: 1675,
      available: 825,
      afterBuffer: 525,
      upfront: 3875,
      withinCeiling: true
    });
    expect(checkApartment(budget, options, costs, 2000)).toMatchObject({
      available: -1175,
      afterBuffer: -1475,
      withinCeiling: false
    });
    expect(checkApartment(budget, options, { ...costs, rent: null }, 4000)).toBeNull();
    expect(checkApartment(budget, options, { ...costs, rent: 0 }, 4000)?.monthly).toBe(175);
  });
});
