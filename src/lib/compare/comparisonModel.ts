import type { City } from '$lib/types';

/** Numeric city-and-salary input shared by comparison analyzers. */
export interface ComparisonEntryInput {
  city: City;
  salary: number;
}

/** City identity and navigation fields safe for comparison views to expose. */
export interface ComparisonCity {
  name: string;
  source: City['source'];
  lat?: number;
  lng?: number;
}

export function toComparisonCity(city: City): ComparisonCity {
  return {
    name: city.name,
    source: city.source,
    lat: city.lat,
    lng: city.lng
  };
}
