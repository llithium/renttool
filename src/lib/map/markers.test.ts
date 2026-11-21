import { describe, expect, it } from 'vitest';
import { markerPresentation, reconcileMarkerKeys } from './markers';

function city(name: string, r1: number | null, lat: number | undefined = 40) {
  return { name, r1, lat, lng: lat == null ? undefined : -74 };
}

describe('map pins', () => {
  it('identifies added, retained, and removed located city keys', () => {
    expect(
      reconcileMarkerKeys(
        ['A, ZZ', 'Removed, ZZ'],
        [city('A, ZZ', 1_000), city('Added, ZZ', 1_200), { name: 'Unplaced, ZZ' }]
      )
    ).toEqual({ added: ['Added, ZZ'], retained: ['A, ZZ'], removed: ['Removed, ZZ'] });
  });

  it('reads fits, tight, and over against the ceiling', () => {
    expect(markerPresentation(city('A, ZZ', 1_000), 1_450, null).state).toBe('within');
    expect(markerPresentation(city('A, ZZ', 1_430), 1_450, null).state).toBe('near');
    expect(markerPresentation(city('A, ZZ', 1_600), 1_450, null).state).toBe('above');
  });

  it('distinguishes a missing salary, missing rent, and a pending lookup', () => {
    expect(markerPresentation(city('A, ZZ', 1_000), null, null).state).toBe('no-salary');
    expect(markerPresentation(city('A, ZZ', null), 1_450, null).state).toBe('unknown');
    expect(markerPresentation(city('A, ZZ', null), 1_450, null, '1br', true).state).toBe(
      'checking'
    );
  });

  it('names the city, rent, verdict, and selection for screen readers', () => {
    const pin = markerPresentation(city('A, ZZ', 1_250), 1_500, 'A, ZZ');
    expect(pin.selected).toBe(true);
    expect(pin.rentText).toBe('$1,250');
    expect(pin.ariaLabel).toBe('A, ZZ, 1-bed $1,250, fits your ceiling, showing now');
  });

  it('uses the shared share of a two-bedroom', () => {
    const pin = markerPresentation(
      { name: 'A, ZZ', r1: 1_000, r2: 2_000 },
      1_200,
      null,
      'shared-2br'
    );
    expect(pin.rentText).toBe('$1,000');
    expect(pin.state).toBe('within');
  });
});
