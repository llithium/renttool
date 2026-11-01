import type { CityImage } from '$lib/types';
import imageData from './city-images.json';
import { cityIdentity } from '$lib/cityIdentity';

export const CITY_IMAGES = imageData as Record<string, CityImage>;

const CITY_IMAGES_BY_KEY = new Map(
  Object.entries(CITY_IMAGES).map(([name, image]) => [cityIdentity(name), image])
);

/** Find the checked-in image for a city without making a network request. */
export function findCityImage(city: string, state: string): CityImage | null {
  return CITY_IMAGES_BY_KEY.get(cityIdentity(`${city}, ${state}`)) ?? null;
}
