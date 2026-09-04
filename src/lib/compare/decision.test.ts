import { describe, expect, it } from 'vitest';
import { analyzeComparison } from './decision';
import { city } from '../../../tests/fixtures/city';

function entry(name: string, salary: number, r1: number | null) {
  return { city: city(name, r1), salary };
}

describe('comparison decision', () => {
  it('excludes missing facts from ranking while displaying genuine zero values', () => {
    const missing = city('Missing, ZZ', 1200);
    const zero = city('Zero, ZZ', 1200);
    missing.citySnapshot = {
      population: 100000,
      householdIncome: 60000,
      commuteMinutes: null,
      renterShare: null,
      rentalVacancy: null
    };
    zero.citySnapshot = {
      population: 100000,
      householdIncome: 60000,
      commuteMinutes: 0,
      renterShare: 0,
      rentalVacancy: 0
    };
    const view = analyzeComparison([
      { city: missing, salary: 80000 },
      { city: zero, salary: 80000 }
    ]);
    for (const key of ['commute', 'renters', 'vacancy'] as const) {
      expect(view.entries[0].metrics[key]).toMatchObject({ number: null, value: '—', tone: null });
      expect(view.entries[1].metrics[key]).toMatchObject({ number: 0, tone: null });
    }
    expect(view.entries[1].metrics.commute.value).toBe('0 min');
    expect(view.entries[1].metrics.vacancy.value).toBe('0%');
  });

  it('turns numeric city salary entries into a complete decision view', () => {
    const view = analyzeComparison([entry('Alpha, ZZ', 80_000, 1_200)]);
    const result = view.entries[0];

    expect(result.metrics.rent1.value).toBe('$1,200/mo');
    expect(result.metrics.rent1.number).toBe(1_200);
    expect(result.rent.metricLabel).toBe('Estimated median 1BR rent');
    expect(result.rentProvenance).toBe('Alpha, ZZ · June 2026');
    expect(result.taxContext).toBe('varies');
    expect(result.rentBudget.value).toBe('$2,000/mo');
    expect(result.fit.label).toBe('$800 under budget');
    expect(view.briefs.afterRent.leaders.map((leader) => leader.city.name)).toEqual(['Alpha, ZZ']);
  });

  it('marks an over-budget rent as a bad fit', () => {
    const view = analyzeComparison([entry('Expensive, ZZ', 60_000, 2_000)]);

    expect(view.entries[0].fit).toEqual({ label: '$500 over budget', tone: 'bad' });
  });

  it('excludes unavailable rent from rent decisions and returns all tied leaders', () => {
    const view = analyzeComparison([
      entry('Alpha, ZZ', 80_000, 1_200),
      entry('Beta, ZZ', 80_000, 1_200),
      entry('Gamma, ZZ', 80_000, null)
    ]);

    expect(view.briefs.rent.eligibleCount).toBe(2);
    expect(view.briefs.rent.status).toBe('tie');
    expect(view.briefs.rent.leaders.map((leader) => leader.city.name)).toEqual([
      'Alpha, ZZ',
      'Beta, ZZ'
    ]);
    expect(view.entries[2].metrics.rent1.value).toBe('—');
  });

  it('ranks available metric values even when another entry is missing one', () => {
    const view = analyzeComparison([
      entry('Alpha, ZZ', 80_000, 1_200),
      entry('Beta, ZZ', 80_000, 1_500),
      entry('Gamma, ZZ', 80_000, null)
    ]);

    expect(view.entries[0].metrics.rent1.tone).toBe('best');
    expect(view.entries[0].metrics.rent1.toneLabel).toBe('Lowest');
    expect(view.entries[1].metrics.rent1.tone).toBe('worst');
    expect(view.entries[1].metrics.rent1.toneLabel).toBe('Highest');
    expect(view.entries[2].metrics.rent1.tone).toBeNull();
  });

  it('returns take-home and after-rent decisions with their own eligibility', () => {
    const view = analyzeComparison([
      entry('Alpha, ZZ', 80_000, 1_200),
      entry('Beta, ZZ', 80_000, null)
    ]);

    expect(view.briefs.afterRent.status).toBe('decided');
    expect(view.briefs.afterRent.eligibleCount).toBe(1);
    expect(view.briefs.afterRent.leaders.map((leader) => leader.city.name)).toEqual(['Alpha, ZZ']);
    expect(view.briefs.takeHome.status).toBe('tie');
    expect(view.briefs.takeHome.leaders.map((leader) => leader.city.name)).toEqual([
      'Alpha, ZZ',
      'Beta, ZZ'
    ]);
  });

  it('reports when no city is eligible for a rent decision', () => {
    const view = analyzeComparison([entry('Gamma, ZZ', 80_000, null)]);

    expect(view.briefs.rent.status).toBe('not-enough-data');
    expect(view.briefs.rent.leaders).toEqual([]);
    expect(view.briefs.rent.detail).toContain('rent estimates');
  });

  it('treats non-finite salaries as missing decision values', () => {
    const view = analyzeComparison([entry('Gamma, ZZ', Number.NaN, 1_200)]);

    expect(view.briefs.takeHome.status).toBe('not-enough-data');
    expect(view.briefs.takeHome.leaders).toEqual([]);
    expect(view.entries[0].metrics.salary.value).toBe('—');
  });
});
