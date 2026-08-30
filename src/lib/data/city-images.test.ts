import { describe, expect, it } from 'vitest';
import { CITY_IMAGES, findCityImage } from './city-images';

describe('checked-in city images', () => {
  it('finds a credited image without a network request', () => {
    expect(findCityImage('Tampa', 'FL')).toMatchObject({
      id: 'VHFBDTwiIy4',
      photographerName: 'Kody Cheyne',
      source: 'unsplash'
    });
  });

  it('normalizes punctuation and the New York City alias', () => {
    expect(findCityImage('New York City', 'ny')?.id).toBe('RQOGrHWDEXM');
  });

  it('keeps every manifest URL on the expected hosts', () => {
    expect(Object.keys(CITY_IMAGES).length).toBeGreaterThan(0);
    for (const image of Object.values(CITY_IMAGES)) {
      expect(new URL(image.url).hostname).toBe('images.unsplash.com');
      expect(new URL(image.photoUrl).hostname).toBe('unsplash.com');
      expect(new URL(image.photographerUrl).hostname).toBe('unsplash.com');
      expect(image.photoUrl).toContain('utm_source=rent_tool');
      expect(image.photographerUrl).toContain('utm_source=rent_tool');
    }
  });
});
