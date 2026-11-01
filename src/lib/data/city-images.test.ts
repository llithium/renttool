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

  it('does not assign the same photo to multiple cities', () => {
    const photos = Object.values(CITY_IMAGES).map((image) => `${image.source}:${image.id}`);
    expect(new Set(photos).size).toBe(photos.length);
  });

  it('requires valid image URLs and complete attribution for every entry', () => {
    for (const image of Object.values(CITY_IMAGES)) {
      if (image.focusY != null) {
        expect(image.focusY).toBeGreaterThanOrEqual(0);
        expect(image.focusY).toBeLessThanOrEqual(100);
      }
      expect(['unsplash', 'wikimedia']).toContain(image.source);
      for (const text of [image.id, image.alt, image.photographerName])
        expect(text.trim()).not.toBe('');
      const wikimedia = image.source === 'wikimedia';
      for (const [value, hosts] of [
        [
          image.url,
          wikimedia ? ['upload.wikimedia.org', 'thumb.wikimedia.org'] : ['images.unsplash.com']
        ],
        [image.photoUrl, [wikimedia ? 'commons.wikimedia.org' : 'unsplash.com']],
        [image.photographerUrl, [wikimedia ? 'commons.wikimedia.org' : 'unsplash.com']],
        [image.sourceUrl, [wikimedia ? 'commons.wikimedia.org' : 'unsplash.com']]
      ] as const) {
        const url = new URL(value);
        expect(url.protocol).toBe('https:');
        expect(hosts).toContain(url.hostname);
        if (!wikimedia) {
          expect(
            url.searchParams.get(url.hostname === 'images.unsplash.com' ? 'ixid' : 'utm_source')
          ).toBeTruthy();
          if (url.hostname === 'unsplash.com')
            expect(url.searchParams.get('utm_source')).toBe('rent_tool');
        }
      }
      if (image.source === 'wikimedia') {
        expect(image.title.trim()).not.toBe('');
        expect(image.licenseName.trim()).not.toBe('');
        expect(new URL(image.licenseUrl).hostname).toBe('creativecommons.org');
        expect(new URL(image.articleUrl).hostname).toBe('en.wikipedia.org');
        expect(image.width).toBeGreaterThanOrEqual(1000);
        expect(image.width / image.height).toBeGreaterThanOrEqual(1.3);
      }
    }
  });
});
