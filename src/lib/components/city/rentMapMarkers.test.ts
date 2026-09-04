import { describe, expect, it } from 'vitest';
import { markerPresentation, reconcileMarkerKeys, type MarkerPalette } from './rentMapMarkers';

const palette: MarkerPalette = {
  neutral: 'neutral',
  fits: 'fits',
  over: 'over',
  accent: 'accent',
  card: 'card'
};

function city(name: string, r1: number | null, lat: number | undefined = 40) {
  return { name, r1, lat, lng: lat == null ? undefined : -74 };
}

describe('rent map marker lifecycle', () => {
  it('identifies added, retained, and removed located city keys', () => {
    expect(
      reconcileMarkerKeys(
        ['A, ZZ', 'Removed, ZZ'],
        [city('A, ZZ', 1_000), city('Added, ZZ', 1_200)]
      )
    ).toEqual({
      added: ['Added, ZZ'],
      retained: ['A, ZZ'],
      removed: ['Removed, ZZ']
    });
  });

  it('changes marker presentation when affordability changes', () => {
    const before = markerPresentation(city('A, ZZ', 2_000), 1_500, null, palette);
    const after = markerPresentation(city('A, ZZ', 2_000), 2_500, null, palette);
    expect(after.fillColor).not.toBe(before.fillColor);
    expect(after.tooltipDetail).not.toBe(before.tooltipDetail);
    expect(after.ariaLabel).toContain('fits budget');
  });

  it('keeps selected marker emphasis in the presentation path', () => {
    expect(markerPresentation(city('A, ZZ', 1_000), 1_500, 'A, ZZ', palette)).toMatchObject({
      radius: 9,
      weight: 3,
      color: 'accent',
      fillColor: 'fits'
    });
  });
});
