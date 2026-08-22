import { describe, expect, it } from 'vitest';
import { restoreRentPlan, serializeRentPlan } from './planRepresentation';

describe('rent-plan representation', () => {
  it('round-trips the salary, active off-list city coordinates, and complete comparison entries', () => {
    const search = serializeRentPlan({
      salary: 80_000.6,
      selected: {
        name: 'Custom, ZZ',
        source: 'hud-fmr',
        lat: 40.1,
        lng: -73.9
      },
      comparisons: [
        {
          city: { name: 'Tampa, FL', source: 'apartment-list' },
          salary: 63_000
        },
        {
          city: {
            name: 'Custom, ZZ',
            source: 'hud-fmr',
            lat: 40.1,
            lng: -73.9
          },
          salary: 71_000
        }
      ]
    });

    expect(search).toBe(
      'salary=80001&city=Custom%2C+ZZ&lat=40.1&lng=-73.9&compare=Tampa%2C+FL&compare-salary=%7B%22name%22%3A%22Tampa%2C+FL%22%2C%22salary%22%3A63000%7D&compare-offlist=%7B%22name%22%3A%22Custom%2C+ZZ%22%2C%22lat%22%3A40.1%2C%22lng%22%3A-73.9%7D&compare-salary=%7B%22name%22%3A%22Custom%2C+ZZ%22%2C%22salary%22%3A71000%7D'
    );

    expect(restoreRentPlan(new URLSearchParams(search))).toEqual({
      salary: 80_001,
      selected: {
        name: 'Custom, ZZ',
        kind: 'off-list',
        lat: 40.1,
        lng: -73.9
      },
      comparisons: [
        {
          city: { name: 'Tampa, FL', kind: 'bundled' },
          salary: 63_000
        },
        {
          city: {
            name: 'Custom, ZZ',
            kind: 'off-list',
            lat: 40.1,
            lng: -73.9
          },
          salary: 71_000
        }
      ],
      hasComparisonState: true
    });
  });

  it('keeps malformed active-city coordinates invalid instead of restoring by name', () => {
    expect(
      restoreRentPlan(new URLSearchParams({ city: 'Custom, ZZ', lat: '91', lng: '-74' })).selected
    ).toEqual({ name: 'Custom, ZZ', kind: 'invalid' });
  });

  it('deduplicates and caps entries while preserving issue 9 salary compatibility', () => {
    const search = new URLSearchParams([
      ['salary', '70000'],
      ['compare', 'Tampa, FL'],
      ['compare', 'tampa, fl'],
      [
        'compare-offlist',
        JSON.stringify({ name: 'Off-list, ZZ', lat: 40.1, lng: -73.9, salary: 72_000 })
      ],
      ['compare-offlist', '{not-json'],
      ['compare-offlist', JSON.stringify({ name: 'Bad, ZZ', lat: 91, lng: -74 })],
      ['compare', 'Austin, TX'],
      ['compare', 'Boston, MA'],
      ['compare', 'Miami, FL'],
      ['compare', 'Seattle, WA'],
      ['compare-salary', '65000'],
      ['compare-salary', JSON.stringify({ name: 'Off-list, ZZ', salary: 76_000 })],
      ['compare-salary', '10000001']
    ]);

    expect(restoreRentPlan(search)).toEqual({
      salary: 70_000,
      selected: null,
      comparisons: [
        { city: { name: 'Tampa, FL', kind: 'bundled' }, salary: 65_000 },
        {
          city: { name: 'Off-list, ZZ', kind: 'off-list', lat: 40.1, lng: -73.9 },
          salary: 76_000
        },
        { city: { name: 'Austin, TX', kind: 'bundled' }, salary: 70_000 },
        { city: { name: 'Boston, MA', kind: 'bundled' }, salary: 70_000 },
        { city: { name: 'Miami, FL', kind: 'bundled' }, salary: 70_000 }
      ],
      hasComparisonState: true
    });
  });

  it('uses the same duplicate and capacity rules when serializing', () => {
    const search = new URLSearchParams(
      serializeRentPlan({
        comparisons: [
          { city: { name: 'Tampa, FL', source: 'apartment-list' }, salary: 60_000 },
          { city: { name: 'tampa, fl', source: 'apartment-list' }, salary: 61_000 },
          { city: { name: 'Missing coordinates, ZZ', source: 'hud-fmr' }, salary: 62_000 },
          {
            city: { name: 'Off-list, ZZ', source: 'none', lat: 40.1, lng: -73.9 },
            salary: 63_000
          },
          { city: { name: 'Austin, TX', source: 'apartment-list' }, salary: 64_000 },
          { city: { name: 'Boston, MA', source: 'apartment-list' }, salary: 65_000 },
          { city: { name: 'Miami, FL', source: 'apartment-list' }, salary: 66_000 },
          { city: { name: 'Seattle, WA', source: 'apartment-list' }, salary: 67_000 }
        ]
      })
    );

    expect(search.getAll('compare')).toEqual([
      'Tampa, FL',
      'Austin, TX',
      'Boston, MA',
      'Miami, FL'
    ]);
    expect(search.getAll('compare-offlist').map((value) => JSON.parse(value))).toEqual([
      { name: 'Off-list, ZZ', lat: 40.1, lng: -73.9 }
    ]);
    expect(
      search
        .getAll('compare-salary')
        .map((value) => JSON.parse(value))
        .map((entry) => entry.salary)
    ).toEqual([60_000, 63_000, 64_000, 65_000, 66_000]);
  });
});
