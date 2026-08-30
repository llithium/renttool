import { describe, expect, it } from 'vitest';
import { matchesCity, selectPhoto, type UnsplashPhoto } from './unsplash-image-matcher';

function photo(location: { city: string; name: string }, altDescription?: string): UnsplashPhoto {
  return { alt_description: altDescription, location };
}

describe('Unsplash city matching', () => {
  it('rejects a same-named city whose location metadata names another state', () => {
    expect(
      matchesCity(
        photo({ city: 'Springfield', name: 'Springfield, Missouri, United States' }),
        'Springfield',
        'IL'
      )
    ).toBe(false);
  });

  it('accepts the requested state from the structured location name', () => {
    expect(
      matchesCity(
        photo({ city: 'Springfield', name: 'Springfield, Illinois, United States' }),
        'Springfield',
        'IL'
      )
    ).toBe(true);
  });

  it('does not treat an incidental state mention in the description as location metadata', () => {
    expect(
      matchesCity(
        photo(
          { city: 'Springfield', name: 'Springfield, Missouri, United States' },
          'A travel poster mentions Illinois'
        ),
        'Springfield',
        'IL'
      )
    ).toBe(false);
  });

  it('keeps a relevant search result when location metadata is absent', () => {
    const sparseResult: UnsplashPhoto = {
      id: 'atlanta-photo',
      alt_description: 'Downtown skyline at sunset',
      location: null
    };

    expect(selectPhoto([sparseResult], 'Atlanta', 'GA')).toBe(sparseResult);
  });

  it('skips an explicitly different city when choosing a sparse fallback', () => {
    const wrongCity: UnsplashPhoto = {
      id: 'san-francisco-photo',
      alt_description: 'City skyline',
      location: { city: 'San Francisco', name: 'San Francisco, California, United States' }
    };
    const sparseResult: UnsplashPhoto = {
      id: 'atlanta-photo',
      alt_description: 'Downtown skyline at sunset',
      location: null
    };

    expect(selectPhoto([wrongCity, sparseResult], 'Atlanta', 'GA')).toBe(sparseResult);
  });

  it('skips an explicitly different state when choosing a sparse fallback', () => {
    const wrongState: UnsplashPhoto = {
      id: 'springfield-mo-photo',
      alt_description: 'Downtown skyline',
      location: { city: 'Springfield', name: 'Springfield, Missouri, United States' }
    };
    const sparseResult: UnsplashPhoto = {
      id: 'springfield-il-photo',
      alt_description: 'Downtown skyline at sunset',
      location: null
    };

    expect(selectPhoto([wrongState, sparseResult], 'Springfield', 'IL')).toBe(sparseResult);
  });
});
