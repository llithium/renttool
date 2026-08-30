import { describe, expect, it } from 'vitest';
import { ACS_DATA_META, findSeedCity, RENT_DATA_META, SEED_CITIES } from './cities';

describe('bundled Apartment List city rents', () => {
  it('loads the complete August 2026 snapshot with source metadata', () => {
    expect(SEED_CITIES.length).toBeGreaterThanOrEqual(632);
    expect(RENT_DATA_META).toMatchObject({
      source: 'Apartment List Rent Estimates',
      period: '2026_08',
      label: 'August 2026',
      termsUrl: 'https://www.apartmentlist.com/about/terms'
    });
  });

  it('maps a known city to the bundled estimates and metric', () => {
    expect(findSeedCity('New York, NY')).toMatchObject({
      r1: 2480,
      r2: 2615,
      yoy: 3.5,
      source: 'apartment-list',
      rentMetric: 'estimated-median',
      rentYear: 'August 2026',
      citySnapshot: {
        population: 8483844,
        householdIncome: 80483,
        commuteMinutes: 40.3,
        renterShare: 67.2,
        rentalVacancy: 3.6
      }
    });
  });

  it('covers every rent city with a dated ACS place snapshot', () => {
    expect(SEED_CITIES.every((city) => city.citySnapshot != null)).toBe(true);
    expect(ACS_DATA_META).toMatchObject({
      year: 2024,
      label: '2020–2024 ACS 5-year estimates',
      geography: 'Census place'
    });
  });

  it('matches punctuation variants used by autocomplete results', () => {
    expect(findSeedCity('St. Petersburg, FL')?.name).toBe('St Petersburg, FL');
    expect(findSeedCity('New York City, NY')?.name).toBe('New York, NY');
  });
});
