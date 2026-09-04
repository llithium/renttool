import { describe, expect, it } from 'vitest';
import { cityHref } from './links';

describe('comparison city links', () => {
  it('creates a city-view link from only navigation fields', () => {
    expect(
      cityHref(
        {
          city: { name: 'Off-list, ZZ', source: 'hud-fmr', lat: 40.1, lng: -73.9 }
        },
        {
          salary: 80_000,
          comparisons: [
            {
              city: { name: 'Off-list, ZZ', source: 'hud-fmr', lat: 40.1, lng: -73.9 },
              salary: 80_000
            },
            { city: { name: 'Anchor, NY', source: 'apartment-list' }, salary: 90_000 }
          ]
        }
      )
    ).toBe(
      '/?salary=80000&city=Off-list%2C+ZZ&lat=40.1&lng=-73.9&compare-offlist=%7B%22name%22%3A%22Off-list%2C+ZZ%22%2C%22lat%22%3A40.1%2C%22lng%22%3A-73.9%7D&compare-salary=%7B%22name%22%3A%22Off-list%2C+ZZ%22%2C%22salary%22%3A80000%7D&compare=Anchor%2C+NY&compare-salary=%7B%22name%22%3A%22Anchor%2C+NY%22%2C%22salary%22%3A90000%7D'
    );
  });

  it('preserves comparison order and omits an off-list city without coordinates', () => {
    const href = cityHref(
      { city: { name: 'Anchor, NY', source: 'apartment-list' } },
      {
        salary: 80_000,
        comparisons: [
          { city: { name: 'Custom, ZZ', source: 'none' }, salary: 80_000 },
          { city: { name: 'Seed, NY', source: 'apartment-list' }, salary: 80_000 },
          { city: { name: 'HUD, ZZ', source: 'hud-fmr', lat: 0, lng: 0 }, salary: 80_000 }
        ]
      }
    );

    const search = new URL(href, 'https://rent.test').searchParams;
    expect([...search.keys()]).toEqual([
      'salary',
      'city',
      'compare',
      'compare-salary',
      'compare-offlist',
      'compare-salary'
    ]);
    expect(search.getAll('compare')).toEqual(['Seed, NY']);
    expect(JSON.parse(search.get('compare-offlist') ?? '')).toEqual({
      name: 'HUD, ZZ',
      lat: 0,
      lng: 0
    });
  });

  it('omits an invalid salary instead of serializing NaN', () => {
    expect(
      cityHref(
        { city: { name: 'Anchor, NY', source: 'apartment-list' } },
        { salary: Number.NaN, comparisons: [] }
      )
    ).toBe('/?city=Anchor%2C+NY');
  });

  it('preserves committed salaries for complete comparison entries', () => {
    const href = cityHref(
      { city: { name: 'Anchor, NY', source: 'apartment-list' } },
      {
        salary: 95_000,
        comparisons: [
          {
            city: { name: 'Anchor, NY', source: 'apartment-list' },
            salary: 63_000
          }
        ]
      }
    );

    const search = new URL(href, 'https://rent.test').searchParams;
    expect(search.get('salary')).toBe('95000');
    expect(search.getAll('compare')).toEqual(['Anchor, NY']);
    expect(JSON.parse(search.get('compare-salary') ?? '')).toEqual({
      name: 'Anchor, NY',
      salary: 63_000
    });
  });
});
