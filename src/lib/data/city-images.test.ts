import { describe, expect, it } from 'vitest';
import { CITY_IMAGES, findCityImage } from './city-images';

describe('checked-in city images', () => {
  it('maps every manifest entry to its city identity', () => {
    expect(Object.keys(CITY_IMAGES).length).toBeGreaterThan(0);
    for (const [name, image] of Object.entries(CITY_IMAGES)) {
      const [city, state] = name.split(', ');
      expect(findCityImage(city, state)).toEqual(image);
    }
  });

  it('normalizes punctuation and the New York City alias', () => {
    expect(CITY_IMAGES['New York, NY']).toBeDefined();
    expect(findCityImage('New York City', 'ny')).toEqual(CITY_IMAGES['New York, NY']);
    expect(findCityImage('Unlisted place', 'ZZ')).toBeNull();
  });

  it('requires valid image URLs and complete attribution for every entry', () => {
    for (const image of Object.values(CITY_IMAGES)) {
      expect(image.source).toBe('unsplash');
      for (const text of [image.id, image.alt, image.photographerName])
        expect(text.trim()).not.toBe('');
      for (const [value, host] of [
        [image.url, 'images.unsplash.com'],
        [image.photoUrl, 'unsplash.com'],
        [image.photographerUrl, 'unsplash.com'],
        [image.sourceUrl, 'unsplash.com']
      ]) {
        const url = new URL(value);
        expect(url.protocol).toBe('https:');
        expect(url.hostname).toBe(host);
        expect(
          url.searchParams.get(host === 'images.unsplash.com' ? 'ixid' : 'utm_source')
        ).toBeTruthy();
        if (host === 'unsplash.com') expect(url.searchParams.get('utm_source')).toBe('rent_tool');
      }
    }
  });
});
