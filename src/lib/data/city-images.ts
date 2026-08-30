import type { CityImage } from '$lib/types';
import imageData from './city-images.json';

export const CITY_IMAGES = imageData as Record<string, CityImage>;

function normalizedCityPart(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[.-]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return normalized === 'new york city' ? 'new york' : normalized;
}

const CITY_IMAGES_BY_KEY = new Map(
  Object.entries(CITY_IMAGES).map(([name, image]) => {
    const [city, state] = name.split(/,\s*/);
    return [`${normalizedCityPart(city)},${state.toUpperCase()}`, image] as const;
  })
);

/** Find the checked-in image for a city without making a network request. */
export function findCityImage(city: string, state: string): CityImage | null {
  return (
    CITY_IMAGES_BY_KEY.get(`${normalizedCityPart(city)},${state.trim().toUpperCase()}`) ?? null
  );
}
