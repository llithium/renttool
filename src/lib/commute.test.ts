import { describe, expect, it } from 'vitest';
import { isLocation, matchesCommute, parseAddresses, parseDurations } from './commute';

describe('commute filtering', () => {
  it('rounds up route times, preserves missing routes, and applies an inclusive limit', () => {
    expect(parseDurations({ code: 'Ok', durations: [[0], [1800], [1801], [null]] }, 4)).toEqual([
      0,
      30,
      31,
      null
    ]);
    const filter = { minutes: { close: 0, boundary: 30, far: 31, unknown: null }, maximum: 30 };
    expect(
      ['close', 'boundary', 'far', 'unknown', 'missing'].filter((label) =>
        matchesCommute(label, filter)
      )
    ).toEqual(['close', 'boundary']);
    expect(matchesCommute('unknown', null)).toBe(true);
  });
  it.each([
    null,
    { code: 'NoRoute' },
    { code: 'Ok', durations: [[-1]] },
    { code: 'Ok', durations: [['20']] },
    { code: 'Ok', durations: [] },
    { code: 'Ok', durations: [[1, 2]] }
  ])('rejects invalid route tables: %j', (body) => {
    expect(parseDurations(body, 1)).toBeNull();
  });
  it('validates coordinates without coercing strings', () => {
    expect(isLocation({ lat: 0, lng: 0 })).toBe(true);
    for (const input of [
      null,
      { lat: '41', lng: 0 },
      { lat: NaN, lng: 0 },
      { lat: 91, lng: 0 },
      { lat: 0, lng: -181 }
    ])
      expect(isLocation(input)).toBe(false);
  });
  it('keeps US street addresses and discards malformed, foreign and duplicate results', () => {
    const feature = {
      properties: {
        countrycode: 'US',
        housenumber: '233',
        street: 'S Wacker Dr',
        city: 'Chicago',
        state: 'Illinois'
      },
      geometry: { coordinates: [-87.636, 41.878] }
    };
    expect(
      parseAddresses({
        features: [
          null,
          {},
          { ...feature, properties: { countrycode: 'DE' } },
          feature,
          feature,
          { ...feature, geometry: { coordinates: [500, 91] } }
        ]
      })
    ).toEqual([{ label: '233 S Wacker Dr, Chicago, Illinois', lat: 41.878, lng: -87.636 }]);
  });
});
