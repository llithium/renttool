import { describe, expect, it } from 'vitest';
import { formatCoordinates, readRent, ridgePaths, ringDash, STAMP_RING } from './postcard';
import { splitLead, wikipediaTitle, wikipediaUrl } from './wikipedia';

describe('reading rent against a ceiling', () => {
  it('says how much is left when rent fits', () => {
    expect(readRent(1_084, 1_450)).toMatchObject({
      fit: 'within',
      percentLabel: '75%',
      verdict: 'Fits, with $366 to spare'
    });
  });

  it('calls rent within 5% of the ceiling tight', () => {
    expect(readRent(1_430, 1_450)).toMatchObject({
      fit: 'near',
      verdict: 'Tight, only $20 to spare'
    });
    expect(readRent(1_450, 1_450).verdict).toBe('Tight, right at your ceiling');
  });

  it('says how far over rent is', () => {
    expect(readRent(1_427, 1_400)).toMatchObject({
      fit: 'above',
      percentLabel: '102%',
      verdict: 'Over by $27'
    });
  });

  it('separates a missing rent from a missing salary', () => {
    expect(readRent(null, 1_450).verdict).toBe('No rent estimate here yet');
    expect(readRent(1_084, null).verdict).toBe('Add a salary to see if it fits');
  });
});

describe('postcard helpers', () => {
  it('formats coordinates with hemispheres', () => {
    expect(formatCoordinates(40.7608, -111.891)).toBe('40.76° N, 111.89° W');
    expect(formatCoordinates(undefined, 1)).toBe('');
  });

  it('draws the same ridgeline for the same city every time', () => {
    expect(ridgePaths('Boise, ID', 560, 640)).toEqual(ridgePaths('Boise, ID', 560, 640));
    expect(ridgePaths('Boise, ID', 560, 640)).not.toEqual(ridgePaths('Raleigh, NC', 560, 640));
  });

  it('caps the stamp ring at a full circle', () => {
    expect(ringDash(2)).toBe(`${STAMP_RING.toFixed(1)} ${STAMP_RING.toFixed(1)}`);
    expect(ringDash(null).startsWith('0.0 ')).toBe(true);
  });
});

describe('Wikipedia helpers', () => {
  it('uses the "City, State" article title', () => {
    expect(wikipediaTitle({ city: 'Salt Lake City', state: 'UT' })).toBe('Salt Lake City, Utah');
    expect(wikipediaUrl({ city: 'Salt Lake City', state: 'UT' })).toBe(
      'https://en.wikipedia.org/wiki/Salt_Lake_City%2C_Utah'
    );
  });

  it('splits the first sentence from the rest of the lead', () => {
    expect(
      splitLead(
        'Salt Lake City is the capital of Utah and its most populous city. It sits in the Salt Lake Valley.'
      )
    ).toEqual({
      first: 'Salt Lake City is the capital of Utah and its most populous city.',
      rest: 'It sits in the Salt Lake Valley.'
    });
    expect(splitLead('Short lead.')).toEqual({ first: 'Short lead.', rest: '' });
  });
});
