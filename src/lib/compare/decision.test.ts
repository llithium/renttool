import { describe, expect, it } from 'vitest';
import { computeBudget } from '$lib/budget';
import { analyzeComparison, analyzeSalaryEquivalence } from './decision';
import type { City } from '$lib/types';

function city(name: string, r1: number | null): City {
  const [cityName, state] = name.split(', ');
  return {
    name,
    city: cityName,
    state,
    r1,
    r2: r1 == null ? null : r1 + 300,
    yoy: 1.2,
    tax: 'varies',
    pop: '100,000',
    citySnapshot: null,
    lat: 40,
    lng: -74,
    source: r1 == null ? 'none' : 'apartment-list',
    rentMetric: r1 == null ? 'unknown' : 'estimated-median',
    rentArea: name,
    rentYear: 'June 2026'
  };
}

function entry(name: string, salary: number, r1: number | null) {
  return { city: city(name, r1), salary };
}

describe('comparison decision', () => {
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

  it('uses the committed salary exactly for the reference entry', () => {
    const view = analyzeSalaryEquivalence(
      [entry('Alpha, ZZ', 80_000, 1_200), entry('Beta, ZZ', 90_000, 1_500)],
      'alpha, zz'
    );

    expect(view.referenceName).toBe('Alpha, ZZ');
    expect(view.entries[0]).toMatchObject({
      isReference: true,
      committedSalary: 80_000,
      requiredSalary: 80_000,
      requiredSalaryValue: '$80,000'
    });
  });

  it('matches salary when rent and modeled taxes are identical', () => {
    const view = analyzeSalaryEquivalence(
      [entry('Austin, TX', 80_000, 1_200), entry('Dallas, TX', 90_000, 1_200)],
      'Austin, TX'
    );

    expect(view.entries[1].requiredSalary).toBe(80_000);
  });

  it('requires more salary for higher rent', () => {
    const view = analyzeSalaryEquivalence(
      [entry('Austin, TX', 80_000, 1_200), entry('Dallas, TX', 80_000, 1_500)],
      'Austin, TX'
    );

    expect(view.entries[1].requiredSalary).toBeGreaterThan(80_000);
  });

  it('reflects modeled state and local tax differences', () => {
    const view = analyzeSalaryEquivalence(
      [entry('Tampa, FL', 80_000, 1_200), entry('New York, NY', 80_000, 1_200)],
      'Tampa, FL'
    );

    expect(view.entries[1].requiredSalary).toBeGreaterThan(80_000);
  });

  it('finds the minimum whole-dollar salary that reaches the target', () => {
    const inputs = [entry('Austin, TX', 80_000, 1_200), entry('Dallas, TX', 82_000, 1_300)];
    const view = analyzeSalaryEquivalence(inputs, 'Austin, TX');
    const result = view.entries[1].requiredSalary;
    const target = view.targetMonthly;

    expect(result).not.toBeNull();
    expect(target).not.toBeNull();
    if (result == null || target == null) throw new Error('Expected a solvable salary.');
    expect(
      computeBudget(result, inputs[1].city).takeHomeMonthly - inputs[1].city.r1!
    ).toBeGreaterThanOrEqual(target);
    expect(
      computeBudget(result - 1, inputs[1].city).takeHomeMonthly - inputs[1].city.r1!
    ).toBeLessThan(target);
  });

  it('falls back to the first entry when the requested reference was removed', () => {
    const view = analyzeSalaryEquivalence(
      [entry('Alpha, ZZ', 80_000, 1_200), entry('Beta, ZZ', 90_000, 1_500)],
      'Deleted, ZZ'
    );

    expect(view.referenceName).toBe('Alpha, ZZ');
    expect(view.entries[0].isReference).toBe(true);
  });

  it('returns explicit unavailable values for missing or unreachable data', () => {
    const missingReferenceRent = analyzeSalaryEquivalence([
      entry('Alpha, ZZ', 80_000, null),
      entry('Beta, ZZ', 90_000, 1_500)
    ]);
    const missingTargetRent = analyzeSalaryEquivalence([
      entry('Alpha, ZZ', 80_000, 1_200),
      entry('Beta, ZZ', 90_000, null)
    ]);
    const nonfiniteReference = analyzeSalaryEquivalence([
      entry('Alpha, ZZ', Number.NaN, 1_200),
      entry('Beta, ZZ', 90_000, 1_500)
    ]);
    const unreachable = analyzeSalaryEquivalence([
      entry('Alpha, ZZ', 10_000_000, 1),
      entry('Beta, ZZ', 90_000, 2_000_000)
    ]);
    const empty = analyzeSalaryEquivalence([]);

    expect(missingReferenceRent.entries[0].unavailableReason).toBe(
      'The reference 1BR rent is unavailable.'
    );
    expect(missingTargetRent.entries[1].unavailableReason).toBe(
      'The target city’s 1BR rent is unavailable.'
    );
    expect(nonfiniteReference.entries[0].unavailableReason).toBe(
      'The reference salary is unavailable.'
    );
    expect(unreachable.entries[1].unavailableReason).toBe(
      'No salary up to the modeled maximum reaches this spending room.'
    );
    expect(empty).toMatchObject({
      referenceName: null,
      targetMonthly: null,
      targetMonthlyValue: '—',
      entries: []
    });
    for (const result of [
      missingReferenceRent,
      missingTargetRent,
      nonfiniteReference,
      unreachable
    ]) {
      expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity|\$0/);
    }
  });
});
