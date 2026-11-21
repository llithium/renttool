import { describe, expect, it } from 'vitest';
import { analyzeComparison } from './decision';
import { briefSentence, criterionLabel } from './brief';
import { money } from '$lib/format';
import type { City } from '$lib/types';

function city(name: string, state: string, r1: number | null): City {
  return {
    name: `${name}, ${state}`,
    city: name,
    state,
    r1,
    r2: r1 == null ? null : r1 * 1.3,
    yoy: null,
    tax: '',
    pop: null,
    populationSource: null,
    citySnapshot: null,
    source: r1 == null ? 'none' : 'apartment-list',
    rentMetric: r1 == null ? 'unknown' : 'estimated-median',
    rentArea: '',
    rentYear: ''
  };
}

describe('comparison brief', () => {
  const view = analyzeComparison([
    { city: city('Alpha', 'TX', 1_000), salary: 60_000 },
    { city: city('Beta', 'TX', 1_500), salary: 60_000 }
  ]);

  it('names the leader and its lead over the next city', () => {
    const left = money(view.entries[0].metrics.after.number);
    expect(briefSentence(view, 'afterRent')).toBe(
      `Alpha leaves the most: ${left} a month, $500 more than Beta.`
    );
    expect(briefSentence(view, 'rent')).toBe(
      'Alpha has the lowest rent: $1,000 a month, $500 less than Beta.'
    );
  });

  it('reports ties and missing data plainly', () => {
    const tie = analyzeComparison([
      { city: city('Alpha', 'TX', 1_000), salary: 60_000 },
      { city: city('Beta', 'TX', 1_000), salary: 60_000 }
    ]);
    expect(briefSentence(tie, 'rent')).toBe(
      'Alpha and Beta tie for the lowest rent at $1,000 a month.'
    );
    const none = analyzeComparison([{ city: city('Gamma', 'TX', null), salary: 60_000 }]);
    expect(briefSentence(none, 'afterRent')).toMatch(/^Add cities with rent estimates/);
  });

  it('labels the rent criterion with the housing in use', () => {
    expect(criterionLabel('rent', '2br')).toBe('Lowest 2-bed rent');
    expect(criterionLabel('afterRent', '1br')).toBe('Most left after rent');
  });
});
