import { describe, expect, it } from 'vitest';
import { ACS_DATA_META, findSeedCity, RENT_DATA_META, SEED_CITIES } from './cities';
import rentData from './apartment-list-rents.json';
import acsData from './acs-city-facts.json';

describe('bundled city data', () => {
  it('maps every source city exactly once with its estimates and provenance', () => {
    expect(Object.keys(rentData.cities).length).toBeGreaterThanOrEqual(600);
    expect(SEED_CITIES.map((city) => city.name).sort()).toEqual(
      Object.keys(rentData.cities).sort()
    );
    for (const [name, rent] of Object.entries(rentData.cities)) {
      expect(findSeedCity(name)).toMatchObject({
        name,
        r1: rent.r1,
        r2: rent.r2,
        yoy: rent.yoy,
        source: 'apartment-list',
        rentMetric: 'estimated-median',
        rentArea: name,
        rentYear: rentData.meta.label
      });
      expect(Number.isFinite(rent.r1) && rent.r1 > 0).toBe(true);
      expect(Number.isFinite(rent.r2) && rent.r2 > 0).toBe(true);
      expect(Number.isFinite(rent.yoy)).toBe(true);
    }
  });

  it('keeps source metadata coherent without pinning a release', () => {
    expect(RENT_DATA_META.period).toMatch(/^\d{4}_(0[1-9]|1[0-2])$/);
    const [year, month] = RENT_DATA_META.period.split('_').map(Number);
    expect(RENT_DATA_META.label).toBe(
      new Date(Date.UTC(year, month - 1)).toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      })
    );
    expect(RENT_DATA_META.source).toBe('Apartment List Rent Estimates');
    expect(new URL(RENT_DATA_META.termsUrl).hostname).toBe('www.apartmentlist.com');
    expect(Number.isInteger(ACS_DATA_META.year)).toBe(true);
    expect(ACS_DATA_META.label).toBe(
      `${ACS_DATA_META.year - 4}–${ACS_DATA_META.year} ACS 5-year estimates`
    );
    expect(ACS_DATA_META.geography).toBe('Census place');
  });

  it('maps the complete ACS city set and preserves missing versus zero facts', () => {
    expect(Object.keys(acsData.cities).sort()).toEqual(Object.keys(rentData.cities).sort());
    for (const [name, facts] of Object.entries(acsData.cities)) {
      expect(findSeedCity(name)?.citySnapshot).toEqual(facts);
      expect(facts.population).toBeGreaterThan(0);
      expect(facts.householdIncome).toBeGreaterThan(0);
      for (const key of ['commuteMinutes', 'renterShare', 'rentalVacancy'] as const) {
        const value = facts[key];
        if (value == null) continue;
        expect(Number.isFinite(value) && value >= 0).toBe(true);
        expect(value).toBeLessThanOrEqual(key === 'commuteMinutes' ? 300 : 100);
      }
    }
  });

  it('matches punctuation variants used by autocomplete results', () => {
    expect(findSeedCity('St. Petersburg, FL')?.name).toBe('St Petersburg, FL');
    expect(findSeedCity('New York City, NY')?.name).toBe('New York, NY');
  });
});
